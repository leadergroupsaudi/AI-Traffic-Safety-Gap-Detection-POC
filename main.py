# main.py

import os
import pandas as pd

from config.settings import (
    VIDEO_PATH,
    TRACKING_XLSX,
    RULES_YAML,
    FINDINGS_CSV,
    SNAPSHOTS_DIR,
)
from rules.rules_engine import RulesEngine
from findings.finding_generator import RecommendationGenerator
from utils.snapshot_extractor import SnapshotExtractor

def main():
    print("Initializing Snapshot Extractor...")
    snapshot_extractor = SnapshotExtractor(VIDEO_PATH)

    print("Loading tracking data...")
    tracking_df = pd.read_excel(TRACKING_XLSX)

    # Format tracking data for the Spatial Engine
    # Manager's engine expects Object, Confidence, Timestamp_sec
    tracking_df.rename(columns={"Object": "Object"}, inplace=True)
    tracking_df["Timestamp_sec"] = (tracking_df["First_Seen_sec"] + tracking_df["Last_Seen_sec"]) / 2
    tracking_df["Confidence"] = 1.0 # Assume 1.0 confidence for tracked objects

    print("Loading Rules Engine (YAML)...")
    rules_engine = RulesEngine(RULES_YAML)
    recommendation_generator = RecommendationGenerator()

    print("Evaluating rules...")
    findings_objects = rules_engine.evaluate(tracking_df)

    final_findings = []

    for f_obj in findings_objects:
        # Convert dataclass to dict
        finding = f_obj.to_dict()

        # Add AI recommendation
        finding = recommendation_generator.generate(finding)

        # Extract snapshot
        snapshot_path = os.path.join(SNAPSHOTS_DIR, f"{finding['finding_id']}.jpg")
        # For direct detections, gap_start_sec is the exact timestamp
        snapshot_extractor.extract_frame(finding["gap_start_sec"], snapshot_path)
        finding["snapshot_path"] = snapshot_path

        final_findings.append(finding)

    result_df = pd.DataFrame(final_findings)
    result_df.to_csv(FINDINGS_CSV, index=False)

    print(f"\nSuccessfully generated {len(result_df)} findings.")
    if not result_df.empty:
        print(result_df[['finding_id', 'rule_id', 'trigger_class', 'risk_priority', 'irap_stars']].head())

if __name__ == "__main__":
    main()