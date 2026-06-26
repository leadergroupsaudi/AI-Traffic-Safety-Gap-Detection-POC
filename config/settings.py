"""
Centralized configuration — all file paths and environment-sensitive values.

Every path defaults to the project-relative value that works both locally
and inside Docker containers (where CWD is /app and bind-mounts overlay
the same relative paths).

Override any value by setting the corresponding environment variable,
either in .env (loaded automatically by load_dotenv()) or as a real
OS/Docker env var.
"""

import os
from dotenv import load_dotenv

load_dotenv()   # .env file is loaded once here; all other modules just import

# ── Data files ────────────────────────────────────────────────
FINDINGS_CSV   = os.environ.get("FINDINGS_CSV",  "data/exports/findings.csv")
TRACKING_XLSX  = os.environ.get("TRACKING_XLSX", "data/raw/unique_objects_tracking_old.xlsx")
RULES_YAML     = os.environ.get("RULES_YAML",    "rules/saudi_traffic_rules.yaml")

# ── Directories ───────────────────────────────────────────────
SNAPSHOTS_DIR        = os.environ.get("SNAPSHOTS_DIR",        "snapshots")
MEDIA_DIR            = os.environ.get("MEDIA_DIR",            "media")
UPLOAD_DIR           = os.environ.get("UPLOAD_DIR",           "media/uploads")
TRACKING_OUTPUT_DIR  = os.environ.get("TRACKING_OUTPUT_DIR",  "data/raw")

# ── ML pipeline inputs (offline scripts only) ─────────────────
MODEL_PATH = os.environ.get("MODEL_PATH", "")
VIDEO_PATH = os.environ.get("VIDEO_PATH", "Sample_full_video.mp4")

# ── OpenAI ────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.environ.get("OPENAI_MODEL",   "gpt-4o")
