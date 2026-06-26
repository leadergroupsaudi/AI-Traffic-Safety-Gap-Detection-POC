"""
Video Processing Pipeline — Step 1
===================================
Input  : Road survey video file (set VIDEO_PATH in .env or environment)
Output : <TRACKING_OUTPUT_DIR>/<video_stem>.xlsx

This script runs YOLO object tracking on a dashcam / survey video and
produces a per-unique-object Excel file.  That Excel file is then consumed
by the AI Engine (main.py) to generate findings.csv and the review dashboard.

Pipeline position:
  input video  →  THIS SCRIPT  →  Excel output
                                       ↓
                              main.py (AI Engine)
                                       ↓
                               findings.csv
                                       ↓
                       generate_annotated_snapshots.py
"""

from ultralytics import YOLO
import cv2
import pandas as pd
import os
import json
import time

from config.settings import MODEL_PATH, VIDEO_PATH, TRACKING_OUTPUT_DIR

# =====================================================
# CONFIG
# =====================================================
CHECKPOINT_INTERVAL = 500
PROGRESS_INTERVAL   = 100

# Derive all output / checkpoint filenames from the video name so that
# each video produces its own file and existing results are never overwritten.
_video_stem      = os.path.splitext(os.path.basename(VIDEO_PATH))[0]
OUTPUT_FILE      = os.path.join(TRACKING_OUTPUT_DIR, f"{_video_stem}.xlsx")
CHECKPOINT_FILE  = os.path.join(TRACKING_OUTPUT_DIR, f"{_video_stem}_checkpoint.json")
CHECKPOINT_EXCEL = os.path.join(TRACKING_OUTPUT_DIR, f"{_video_stem}_checkpoint.xlsx")

# Abort early if the final output already exists for this video
if os.path.exists(OUTPUT_FILE):
    raise FileExistsError(
        f"\nOutput file already exists: {OUTPUT_FILE}\n"
        "Rename or move the existing file before re-processing this video."
    )

# =====================================================
# LOAD MODEL
# =====================================================
if not MODEL_PATH:
    raise EnvironmentError("MODEL_PATH is not set. Add it to your .env file.")

print("\nLoading model...")
model = YOLO(MODEL_PATH)
print("Model loaded successfully")

# =====================================================
# OPEN VIDEO
# =====================================================
cap = cv2.VideoCapture(VIDEO_PATH)
if not cap.isOpened():
    raise Exception(f"Cannot open video: {VIDEO_PATH}")

fps               = cap.get(cv2.CAP_PROP_FPS)
total_frames      = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
video_duration_sec = total_frames / fps

print(f"\nTotal Frames      : {total_frames}")
print(f"Video FPS         : {fps:.2f}")
print(f"Video Duration    : {video_duration_sec/60:.2f} minutes")

# =====================================================
# RESUME SUPPORT
# =====================================================
tracked_objects = {}
frame_num = 0

if os.path.exists(CHECKPOINT_FILE):
    print("\nCheckpoint found")
    with open(CHECKPOINT_FILE, "r") as f:
        checkpoint = json.load(f)
    frame_num = checkpoint["last_frame"]
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
    print(f"Resuming from frame: {frame_num}")
    if os.path.exists(CHECKPOINT_EXCEL):
        df_old = pd.read_excel(CHECKPOINT_EXCEL)
        for _, row in df_old.iterrows():
            tracked_objects[int(row["Track_ID"])] = {
                "Track_ID":        int(row["Track_ID"]),
                "Object":          row["Object"],
                "First_Seen_sec":  float(row["First_Seen_sec"]),
                "Last_Seen_sec":   float(row["Last_Seen_sec"]),
                "Detection_Count": int(row["Detection_Count"])
            }
        print(f"Loaded {len(tracked_objects)} tracked objects from checkpoint")
else:
    print("\nNo checkpoint found")
    print("Starting fresh")

# =====================================================
# PROCESSING
# =====================================================
processed_frames = 0
start_time = time.time()
print("\nProcessing video with tracking...")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_num        += 1
    processed_frames += 1
    timestamp_sec     = frame_num / fps

    # -------------------------------------------------
    # YOLO TRACKING
    # -------------------------------------------------
    results = model.track(
        source=frame,
        persist=True,
        tracker="bytetrack.yaml",
        conf=0.25,
        verbose=False
    )
    result = results[0]

    if result.boxes.id is not None:
        for box, track_id in zip(result.boxes, result.boxes.id):
            track_id   = int(track_id)
            class_id   = int(box.cls[0])
            class_name = model.names[class_id]

            if track_id not in tracked_objects:
                tracked_objects[track_id] = {
                    "Track_ID":        track_id,
                    "Object":          class_name,
                    "First_Seen_sec":  round(timestamp_sec, 2),
                    "Last_Seen_sec":   round(timestamp_sec, 2),
                    "Detection_Count": 1
                }
            else:
                tracked_objects[track_id]["Last_Seen_sec"]    = round(timestamp_sec, 2)
                tracked_objects[track_id]["Detection_Count"] += 1

    # -------------------------------------------------
    # PROGRESS
    # -------------------------------------------------
    if frame_num % PROGRESS_INTERVAL == 0:
        elapsed          = time.time() - start_time
        fps_processing   = processed_frames / elapsed
        remaining_frames = total_frames - frame_num
        eta_sec          = remaining_frames / fps_processing
        progress         = (frame_num / total_frames) * 100

        print("\n" + "=" * 60)
        print(f"Progress            : {progress:.2f}%")
        print(f"Frames Processed    : {frame_num}/{total_frames}")
        print(f"Processing FPS      : {fps_processing:.2f}")
        print(f"Unique Objects      : {len(tracked_objects)}")
        print(f"Elapsed Time        : {elapsed/60:.2f} min")
        print(f"ETA Remaining       : {eta_sec/60:.2f} min")
        print("=" * 60)

    # -------------------------------------------------
    # CHECKPOINT SAVE
    # -------------------------------------------------
    if frame_num % CHECKPOINT_INTERVAL == 0:
        pd.DataFrame(tracked_objects.values()).to_excel(CHECKPOINT_EXCEL, index=False)
        with open(CHECKPOINT_FILE, "w") as f:
            json.dump({"last_frame": frame_num}, f)
        print(f"\nCheckpoint saved at frame {frame_num}")

# =====================================================
# CLEANUP VIDEO
# =====================================================
cap.release()

# =====================================================
# FINAL DATAFRAME
# =====================================================
df = pd.DataFrame(tracked_objects.values())

# =====================================================
# TIME CONVERSION
# =====================================================
def sec_to_mmss(sec):
    m = int(sec // 60)
    s = int(sec % 60)
    return f"{m:02d}:{s:02d}"

df["First_Seen"] = df["First_Seen_sec"].apply(sec_to_mmss)
df["Last_Seen"]  = df["Last_Seen_sec"].apply(sec_to_mmss)

# =====================================================
# DURATION
# =====================================================
df["Duration_sec"] = df["Last_Seen_sec"] - df["First_Seen_sec"]

# =====================================================
# SORT
# =====================================================
df = df.sort_values(by="First_Seen_sec")

# =====================================================
# SAVE FINAL OUTPUT  →  TRACKING_OUTPUT_DIR  (read by main.py / api)
# =====================================================
os.makedirs(TRACKING_OUTPUT_DIR, exist_ok=True)
df.to_excel(OUTPUT_FILE, index=False)

# =====================================================
# REMOVE CHECKPOINTS
# =====================================================
if os.path.exists(CHECKPOINT_FILE):
    os.remove(CHECKPOINT_FILE)
if os.path.exists(CHECKPOINT_EXCEL):
    os.remove(CHECKPOINT_EXCEL)

# =====================================================
# SUMMARY
# =====================================================
print("\n" + "=" * 60)
print("PROCESS COMPLETED")
print(f"\nTotal Unique Objects : {len(df)}")
print(f"Output File          : {OUTPUT_FILE}")
print("\nSample Output:")
print(df.head())
print("\n" + "=" * 60)
