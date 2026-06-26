# generate_annotated_snapshots.py
#
# PURPOSE:
#   For each finding in findings.csv, extract the exact video frame,
#   run YOLO on it, draw a bounding box ONLY for the matched class,
#   and save the annotated image to the snapshots/ folder.
#
# HOW TO RUN:
#   source .venv/bin/activate
#   python generate_annotated_snapshots.py

from ultralytics import YOLO
import cv2
import pandas as pd
import os

from config.settings import MODEL_PATH, VIDEO_PATH, FINDINGS_CSV, SNAPSHOTS_DIR

# How many seconds to scan either side of evidence_timestamp
# if YOLO doesn't find the object at the exact frame.
# e.g. 3.0 = scan ±3 seconds (6 sec window total)
SCAN_RANGE_SEC = 3.0

# ─────────────────────────────────────────────
# LOAD MODEL
# ─────────────────────────────────────────────
print("\nLoading YOLO model...")
model = YOLO(MODEL_PATH)
print("Model loaded.\n")

# ─────────────────────────────────────────────
# LOAD FINDINGS
# ─────────────────────────────────────────────
df = pd.read_csv(FINDINGS_CSV)
df["trigger_confidence"] = df["trigger_confidence"].astype(float)
print(f"Findings loaded: {len(df)} rows\n")

# ─────────────────────────────────────────────
# OPEN VIDEO
# ─────────────────────────────────────────────
cap = cv2.VideoCapture(VIDEO_PATH)

if not cap.isOpened():
    raise Exception(f"Cannot open video: {VIDEO_PATH}")

fps         = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"Video FPS    : {fps:.2f}")
print(f"Total frames : {total_frames}")
print(f"Duration     : {total_frames / fps:.1f} sec\n")

os.makedirs(SNAPSHOTS_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# HELPER — draw a single box on a frame
# ─────────────────────────────────────────────
def draw_box(frame, x1, y1, x2, y2, label, conf):
    """Draws a red bounding box with white label on the frame.
    Label position adjusts automatically to stay fully within frame bounds."""

    color = (0, 0, 255)   # Red in BGR
    img_h, img_w = frame.shape[:2]

    # Box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)

    # Label text with confidence
    label_text = f"{label.replace('_', ' ').title()}  {conf:.0%}"
    (tw, th), _ = cv2.getTextSize(
        label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2
    )

    # ── Horizontal: prevent label going off the right edge ───────────────
    label_x = x1
    if label_x + tw + 8 > img_w:
        label_x = max(0, img_w - tw - 8)

    # ── Vertical: if box is at very top, drop label below the box ────────
    if y1 - th - 14 < 0:
        # Place label BELOW the top edge of the box
        bg_y1   = y1 + 2
        bg_y2   = y1 + th + 16
        text_y  = y1 + th + 7
    else:
        # Normal: label ABOVE the top edge of the box
        bg_y1   = y1 - th - 14
        bg_y2   = y1
        text_y  = y1 - 7

    # Filled label background
    cv2.rectangle(
        frame,
        (label_x, bg_y1),
        (label_x + tw + 8, bg_y2),
        color,
        -1
    )

    # Label text
    cv2.putText(
        frame,
        label_text,
        (label_x + 4, text_y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    return frame


# ─────────────────────────────────────────────
# HELPER — find best annotated frame for one finding
# ─────────────────────────────────────────────
def get_annotated_frame(cap, fps, total_frames, target_sec, class_name):
    """
    Strategy:
    1. Seek to target_sec (evidence_timestamp = midpoint of first/last seen)
    2. Run YOLO → look for class_name match
    3. If not found, scan forward/backward up to SCAN_RANGE_SEC
    4. Pick the detection with the highest confidence
    5. Return (annotated_frame, confidence) or (plain_frame, 0) as fallback
    """

    target_frame = int(target_sec * fps)
    scan_start   = max(0, int((target_sec - SCAN_RANGE_SEC) * fps))
    scan_end     = min(total_frames - 1, int((target_sec + SCAN_RANGE_SEC) * fps))

    # Sample ~every 0.5 seconds in the scan window (not every single frame)
    step = max(1, int(fps * 0.5))
    frames_to_try = list(range(scan_start, scan_end, step))

    # Always try the exact target frame first
    if target_frame not in frames_to_try:
        frames_to_try.insert(0, target_frame)

    best_frame_img  = None
    best_confidence = 0.0
    plain_frame_img = None

    for frame_num in frames_to_try:

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()

        if not ret:
            continue

        # Save the first plain frame as fallback
        if plain_frame_img is None:
            plain_frame_img = frame.copy()

        # Run YOLO on this frame (no tracking, just single-frame predict)
        results = model.predict(source=frame, conf=0.20, verbose=False)
        result  = results[0]

        if result.boxes is None or len(result.boxes) == 0:
            continue

        for box in result.boxes:

            detected_class = model.names[int(box.cls[0])]
            conf           = float(box.conf[0])

            # Normalize for comparison (some models use spaces, some underscores)
            detected_norm = detected_class.lower().replace(" ", "_").replace("-", "_")
            target_norm   = class_name.lower().replace(" ", "_").replace("-", "_")

            if detected_norm == target_norm and conf > best_confidence:

                best_confidence = conf

                x1, y1, x2, y2 = map(int, box.xyxy[0])

                annotated = frame.copy()
                annotated = draw_box(annotated, x1, y1, x2, y2, class_name, conf)
                best_frame_img = annotated

    if best_frame_img is not None:
        return best_frame_img, best_confidence, True

    # Fallback — return plain frame (object not detected in scan window)
    return plain_frame_img, 0.0, False


# ─────────────────────────────────────────────
# MAIN LOOP — process each finding
# ─────────────────────────────────────────────
print("=" * 60)
print(f"Processing {len(df)} findings...")
print("=" * 60)

success_count  = 0
fallback_count = 0

for i, row in df.iterrows():

    finding_id        = row["finding_id"]
    object_name       = row["trigger_class"]
    evidence_timestamp = float(row["gap_start_sec"])
    snapshot_path     = os.path.join(SNAPSHOTS_DIR, f"{finding_id}.jpg")

    print(f"\n[{i+1}/{len(df)}]  {finding_id}  |  {object_name}  |  t={evidence_timestamp}s")

    annotated_img, conf, found = get_annotated_frame(
        cap, fps, total_frames, evidence_timestamp, object_name
    )

    if annotated_img is not None:
        cv2.imwrite(snapshot_path, annotated_img)

    if found:
        print(f"   ✓  Annotated snapshot saved  (confidence: {conf:.1%})")
        success_count += 1
    else:
        print(f"   ⚠  Object not found in scan window — plain frame saved as fallback")
        fallback_count += 1

    # Update snapshot_path and actual detection confidence in dataframe
    df.at[i, "snapshot_path"]      = snapshot_path
    df.at[i, "trigger_confidence"] = round(conf, 4)

# ─────────────────────────────────────────────
# CLEANUP & SAVE
# ─────────────────────────────────────────────
cap.release()

df.to_csv(FINDINGS_CSV, index=False)

print("\n" + "=" * 60)
print("COMPLETE")
print(f"  Annotated snapshots  : {success_count}")
print(f"  Fallback (plain)     : {fallback_count}")
print(f"  CSV updated          : {FINDINGS_CSV}")
print(f"  Snapshots folder     : {SNAPSHOTS_DIR}/")
print("=" * 60)
