import os
from typing import Optional
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import pandas as pd

# Paths
FINDINGS_CSV = "data/exports/findings.csv"
SNAPSHOTS_DIR = "snapshots"

# Only these four detection classes are surfaced across all endpoints
ALLOWED_CLASSES = {'street_light', 'manholes', 'emergency_sign', 'ambulance_entrance'}

app = FastAPI(
    title="AI Traffic Safety - Review API",
    description="Backend for the Human-in-the-Loop review dashboard.",
    version="1.0.0"
)

# Phase 1: CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (update for production)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Mount static directories
MEDIA_DIR = "media"
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
os.makedirs(MEDIA_DIR, exist_ok=True)
app.mount("/snapshots", StaticFiles(directory=SNAPSHOTS_DIR), name="snapshots")
app.mount("/media",     StaticFiles(directory=MEDIA_DIR),     name="media")


# Phase 2: Database Operations (CSV)
def _read_findings() -> pd.DataFrame:
    if not os.path.exists(FINDINGS_CSV):
        # Return an empty dataframe if file doesn't exist yet
        return pd.DataFrame()
    return pd.read_csv(FINDINGS_CSV)

def _write_findings(df: pd.DataFrame):
    df.to_csv(FINDINGS_CSV, index=False)


# Request Models
class StatusUpdateRequest(BaseModel):
    status: str  # e.g., "CONFIRMED", "REJECTED", "PENDING_REVIEW"


# Phase 3: Endpoints

@app.get("/api/findings", summary="Get all findings")
def get_findings(status: Optional[str] = None, zone: Optional[str] = None):
    """
    Returns a list of findings.
    Optionally filter by status (e.g. ?status=PENDING_REVIEW).
    Optionally filter by hospital zone (e.g. ?zone=City+General+Memorial).
    """
    df = _read_findings()
    if df.empty:
        return []

    df = df[df["trigger_class"].isin(ALLOWED_CLASSES)]

    if zone and 'hospital_zone' in df.columns:
        df = df[df['hospital_zone'] == zone]

    if status:
        df = df[df["status"] == status]

    import numpy as np
    df = df.replace({np.nan: None})
    return df.to_dict(orient="records")


TRACKING_XLSX = "data/raw/unique_objects_tracking_old.xlsx"
FPS = 30


UPLOAD_DIR = "media/uploads"


@app.post("/api/upload", summary="Upload a video file")
async def upload_video(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = os.path.basename(file.filename or "upload.mp4")
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as f:
        while True:
            chunk = await file.read(8 * 1024 * 1024)   # 8 MB chunks
            if not chunk:
                break
            f.write(chunk)

    size = os.path.getsize(file_path)
    return {"filename": safe_name, "size": size, "status": "uploaded"}


@app.get("/api/stats", summary="Get computed dashboard statistics")
def get_stats(zone: Optional[str] = None):
    df = _read_findings()
    stats = {
        "total_findings": 0,
        "gaps_detected": 0,
        "critical_gaps": 0,
        "avg_risk_score": 0.0,
        "avg_confidence": 0.0,
        "top_class": None,
        "by_class": {},
        "by_priority": {},
    }

    if not df.empty:
        import numpy as np
        df = df[df["trigger_class"].isin(ALLOWED_CLASSES)]

        if zone and 'hospital_zone' in df.columns:
            df = df[df['hospital_zone'] == zone]
        df["risk_score"] = pd.to_numeric(df["risk_score"], errors="coerce").fillna(0)
        df["trigger_confidence"] = pd.to_numeric(df["trigger_confidence"], errors="coerce").fillna(0)
        stats["total_findings"]  = len(df)
        stats["gaps_detected"]   = int((df["risk_score"] > 0).sum())
        stats["critical_gaps"]   = int((df["risk_priority"] == "HIGH").sum())
        stats["avg_risk_score"]  = round(float(df["risk_score"].mean()), 2)
        stats["by_class"]        = df["trigger_class"].value_counts().to_dict()
        stats["by_priority"]     = df["risk_priority"].value_counts().to_dict()
        top = df["trigger_class"].value_counts().idxmax()
        stats["top_class"]       = str(top)

    # Compute real detection-rate confidence from raw tracking data
    if os.path.exists(TRACKING_XLSX):
        try:
            import pandas as _pd
            track = _pd.read_excel(TRACKING_XLSX)
            track["conf"] = (
                track["Detection_Count"] /
                (track["Duration_sec"].clip(lower=1 / FPS) * FPS)
            ).clip(upper=1.0)
            stats["avg_confidence"] = round(float(track["conf"].mean()), 4)
        except Exception:
            stats["avg_confidence"] = round(float(df["trigger_confidence"].mean()), 4) if not df.empty else 0.0
    elif not df.empty:
        stats["avg_confidence"] = round(float(df["trigger_confidence"].mean()), 4)

    return stats


@app.get("/api/rules", summary="Get rule definitions with detection statistics")
def get_rules(zone: Optional[str] = None):
    import yaml

    YAML_PATH = "rules/saudi_traffic_rules.yaml"

    yaml_rules = []
    try:
        with open(YAML_PATH, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        yaml_rules = config.get('rules', [])
    except Exception:
        yaml_rules = []

    df = _read_findings()
    counts: dict = {}
    total_findings = 0

    if not df.empty:
        df = df[df["trigger_class"].isin(ALLOWED_CLASSES)]

        if zone and 'hospital_zone' in df.columns:
            df = df[df['hospital_zone'] == zone]

        total_findings = len(df)
        import numpy as np
        df_clean = df[['rule_id', 'rule_name']].fillna('')
        grouped = df_clean.groupby(['rule_id', 'rule_name']).size()
        for (rid, rname), cnt in grouped.items():
            counts[(str(rid), str(rname))] = int(cnt)

    result = []
    seen: set = set()

    for rule in yaml_rules:
        rule_id = str(rule.get('id', ''))
        rule_name = str(rule.get('name', ''))
        key = (rule_id, rule_name)
        if key in seen:
            continue
        seen.add(key)

        enabled = bool(rule.get('enabled', True))
        detections = counts.get(key, 0)
        coverage_pct = round(detections / total_findings * 100, 1) if total_findings > 0 else 0.0
        risk = rule.get('risk', {}) or {}

        result.append({
            'id': rule_id,
            'name': rule_name,
            'standard': str(rule.get('standard', '')),
            'trigger_class': str(rule.get('trigger_class', '')),
            'rule_type': str(rule.get('rule_type', 'direct_detection')),
            'base_score': int(risk.get('base_score', 0)),
            'priority': str(risk.get('priority', 'LOW')),
            'enabled': enabled,
            'detections': detections,
            'coverage_pct': coverage_pct,
        })

    return {'total_findings': total_findings, 'rules': result}


@app.get("/api/findings/export", summary="Download findings as Excel")
def export_findings():
    if not os.path.exists(FINDINGS_CSV):
        raise HTTPException(status_code=404, detail="No findings to export.")
    import io
    from fastapi.responses import StreamingResponse
    df = _read_findings()
    df = df[df["trigger_class"].isin(ALLOWED_CLASSES)]
    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine="openpyxl")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=traffic_safety_report.xlsx"},
    )


@app.get("/api/findings/{finding_id}", summary="Get a specific finding")
def get_finding(finding_id: str):
    """
    Returns the details of a single finding.
    """
    df = _read_findings()
    if df.empty:
        raise HTTPException(status_code=404, detail="Findings database is empty.")
    
    finding = df[df["finding_id"] == finding_id]
    if finding.empty:
        raise HTTPException(status_code=404, detail=f"Finding {finding_id} not found.")
    
    import numpy as np
    finding = finding.replace({np.nan: None})
    return finding.to_dict(orient="records")[0]


@app.post("/api/findings/{finding_id}/status", summary="Update finding status")
def update_status(finding_id: str, request: StatusUpdateRequest):
    """
    Updates the review status of a finding.
    """
    df = _read_findings()
    if df.empty:
        raise HTTPException(status_code=404, detail="Findings database is empty.")
        
    if finding_id not in df["finding_id"].values:
        raise HTTPException(status_code=404, detail=f"Finding {finding_id} not found.")
        
    # Valid status checks (optional but recommended)
    valid_statuses = ["PENDING_REVIEW", "CONFIRMED", "REJECTED", "EDITED"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        
    # Update the status
    df.loc[df["finding_id"] == finding_id, "status"] = request.status
    
    # Save to disk
    _write_findings(df)
    
    # Return the updated finding
    updated = df[df["finding_id"] == finding_id]
    import numpy as np
    updated = updated.replace({np.nan: None})
    return updated.to_dict(orient="records")[0]
