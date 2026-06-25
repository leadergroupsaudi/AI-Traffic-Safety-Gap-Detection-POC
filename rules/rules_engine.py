"""
Rules Engine
------------
Loads rules from saudi_traffic_rules.yaml, evaluates only the enabled
rules against a detections DataFrame, and emits structured findings.

Each finding matches the SoW output schema:
    finding_id, rule_id, risk_priority, estimated_position_meters,
    confidence_score, recommended_action, status, score_breakdown
"""

from __future__ import annotations

import uuid
import yaml
import pandas as pd
from dataclasses import dataclass, asdict
from pathlib import Path

from .spatial_indexer import SpatialIndexer, DetectionGap
from .risk_scorer import RiskScorer, ScoreBreakdown


@dataclass
class Finding:
    """A single safety gap finding, ready for review or export."""
    finding_id: str
    rule_id: str
    rule_name: str
    standard: str

    # Risk
    risk_score: int
    risk_priority: str
    irap_stars: int
    irap_label: str

    # Location (time + estimated distance — no GPS in POC)
    gap_start_sec: float
    gap_end_sec: float
    gap_duration_sec: float
    estimated_gap_meters: float
    position_start_meters: float
    position_end_meters: float

    # Evidence
    trigger_class: str
    trigger_confidence: float
    # Action
    recommended_action: str
    
    # Optional Fields
    track_id: str = None  # Preserved for evidence snapshot generator
    status: str = "PENDING_REVIEW"  # PENDING_REVIEW | CONFIRMED | REJECTED | EDITED

    # Full score breakdown for audit trail
    score_breakdown: dict = None

    def to_dict(self) -> dict:
        return asdict(self)


class RulesEngine:
    """
    Evaluates enabled rules from a YAML config against a detections CSV.

    Usage
    -----
        engine = RulesEngine("rules/saudi_traffic_rules.yaml")
        findings = engine.evaluate(detections_df)
    """

    def __init__(self, rules_path: str | Path):
        self._rules_path = Path(rules_path)
        self._config = self._load_yaml()
        self._scorer = RiskScorer(self._config["scoring"])
        self._indexer = SpatialIndexer(
            vehicle_speed_kmh=self._config["config"]["vehicle_speed_kmh"]
        )
        self._min_conf = self._config["config"]["min_confidence_threshold"]

    # ── Public API ───────────────────────────────────────────────

    def evaluate(self, detections: pd.DataFrame) -> list[Finding]:
        """
        Run all enabled rules against `detections` and return findings.

        Parameters
        ----------
        detections : pd.DataFrame
            Must have columns: Object, Confidence, Timestamp_sec
        """
        self._validate_df(detections)

        findings: list[Finding] = []
        enabled_rules = [r for r in self._config["rules"] if r.get("enabled", False)]

        for rule in enabled_rules:
            rule_findings = self._dispatch(rule, detections)
            findings.extend(rule_findings)

        # Sort by position so findings are in road order
        findings.sort(key=lambda f: f.position_start_meters)
        return findings

    def get_rule_status(self) -> list[dict]:
        """Return a summary of all rules and their enabled/pending status."""
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "enabled": r.get("enabled", False),
                "requires_classes": r.get("requires_classes", []),
            }
            for r in self._config["rules"]
        ]

    def get_config(self) -> dict:
        return self._config["config"]

    # ── Rule Dispatch ────────────────────────────────────────────

    def _dispatch(self, rule: dict, detections: pd.DataFrame) -> list[Finding]:
        """Route rule to its evaluator based on rule_type."""
        rule_type = rule.get("rule_type", "")

        if rule_type == "direct_detection":
            return self._eval_direct_detection(rule, detections)

        if rule_type == "spacing":
            return self._eval_spacing(rule, detections)

        if rule_type == "context_spacing":
            return self._eval_context_spacing(rule, detections)

        if rule_type == "co_presence":
            return self._eval_co_presence(rule, detections)

        if rule_type == "context_co_presence":
            return self._eval_context_co_presence(rule, detections)

        return []

    # ── Rule Evaluators ──────────────────────────────────────────

    def _eval_direct_detection(self, rule: dict, detections: pd.DataFrame) -> list[Finding]:
        """
        Layer 1 type: Flag every instance of the trigger class.
        Uses the exact timestamp and track_id for snapshot generation.
        """
        params = rule.get("parameters", {})
        target = rule["trigger_class"]
        min_conf = params.get("confidence_threshold", self._min_conf)

        if "Object" not in detections.columns:
            return []
            
        mask = (detections["Object"] == target) & (detections["Confidence"] >= min_conf)
        valid = detections[mask]
        
        findings = []
        for _, row in valid.iterrows():
            trigger_conf = float(row["Confidence"])
            t_sec = float(row.get("Timestamp_sec", 0.0))
            pos_m = self._indexer.timestamp_to_meters(t_sec)
            track_id = str(row.get("Track_ID", ""))
            
            score: ScoreBreakdown = self._scorer.score(
                base_score=rule["risk"]["base_score"],
                trigger_confidence=trigger_conf,
                zone_context="general_road",
                violation_count_in_zone=1,
            )

            findings.append(
                Finding(
                    finding_id=f"F-{str(uuid.uuid4())[:8].upper()}",
                    rule_id=rule["id"],
                    rule_name=rule["name"],
                    standard=rule["standard"],
                    risk_score=score.final_score,
                    risk_priority=score.risk_priority,
                    irap_stars=score.irap_stars,
                    irap_label=score.irap_label,
                    gap_start_sec=t_sec,
                    gap_end_sec=t_sec,
                    gap_duration_sec=0.0,
                    estimated_gap_meters=0.0,
                    position_start_meters=pos_m,
                    position_end_meters=pos_m,
                    trigger_class=target,
                    trigger_confidence=trigger_conf,
                    track_id=track_id,
                    recommended_action=rule["recommended_action"].strip(),
                    status="PENDING_REVIEW",
                    score_breakdown=asdict(score),
                )
            )
        return findings

    def _eval_spacing(self, rule: dict, detections: pd.DataFrame) -> list[Finding]:
        """
        R-07 type: find gaps in a single class that exceed max_gap_meters.
        """
        params = rule["parameters"]
        target = rule["trigger_class"]
        min_conf = params.get("confidence_threshold", self._min_conf)
        min_gap_sec = params.get("min_gap_seconds", 3.6)

        gaps = self._indexer.find_gaps(
            detections, target, min_confidence=min_conf, min_gap_seconds=min_gap_sec
        )

        if not gaps:
            return []

        # Count total gaps for compound factor
        total_gaps = len(gaps)

        findings = []
        for i, gap in enumerate(gaps):
            # Trigger confidence = average of the confidence before and after the gap
            trigger_conf = round((gap.confidence_before + gap.confidence_after) / 2, 4)

            # CVF: compound based on how many total gaps exist in a 200m zone
            nearby = self._count_nearby_gaps(gap, gaps, zone_meters=200.0)
            score: ScoreBreakdown = self._scorer.score(
                base_score=rule["risk"]["base_score"],
                trigger_confidence=trigger_conf,
                zone_context="general_road",
                violation_count_in_zone=nearby,
            )

            findings.append(
                Finding(
                    finding_id=f"F-{str(uuid.uuid4())[:8].upper()}",
                    rule_id=rule["id"],
                    rule_name=rule["name"],
                    standard=rule["standard"],
                    risk_score=score.final_score,
                    risk_priority=score.risk_priority,
                    irap_stars=score.irap_stars,
                    irap_label=score.irap_label,
                    gap_start_sec=gap.gap_start_sec,
                    gap_end_sec=gap.gap_end_sec,
                    gap_duration_sec=gap.gap_duration_sec,
                    estimated_gap_meters=gap.estimated_gap_meters,
                    position_start_meters=gap.position_start_meters,
                    position_end_meters=gap.position_end_meters,
                    trigger_class=target,
                    trigger_confidence=trigger_conf,
                    recommended_action=rule["recommended_action"].strip(),
                    status="PENDING_REVIEW",
                    score_breakdown=asdict(score),
                )
            )

        return findings

    def _eval_context_spacing(self, rule: dict, detections: pd.DataFrame) -> list[Finding]:
        """
        R-08 type: gap check with tighter threshold when near a context class.
        (Placeholder — active only when context classes are detected.)
        """
        # Requires context classes — check if any are present
        context_classes = rule.get("context_classes", [])
        for cls in context_classes:
            if cls not in detections["Object"].unique():
                return []  # Context class not yet detected

        params = rule["parameters"]
        target = rule["trigger_class"]
        min_conf = params.get("confidence_threshold", self._min_conf)
        min_gap_sec = params.get("min_gap_seconds", 2.25)
        zone_radius = params.get("emergency_zone_radius_meters", 100.0)

        all_gaps = self._indexer.find_gaps(
            detections, target, min_confidence=min_conf, min_gap_seconds=min_gap_sec
        )

        findings = []
        for gap in all_gaps:
            mid_m = (gap.position_start_meters + gap.position_end_meters) / 2

            # Check if any context class is within zone_radius
            window_start = max(0, mid_m / self._indexer.speed_ms - zone_radius / self._indexer.speed_ms)
            window_end   = mid_m / self._indexer.speed_ms + zone_radius / self._indexer.speed_ms
            present = self._indexer.classes_present_in_window(
                detections, window_start, window_end, min_conf
            )

            active_context = [c for c in context_classes if c in present]
            if not active_context:
                continue

            zone_ctx = f"near_{active_context[0]}"
            trigger_conf = round((gap.confidence_before + gap.confidence_after) / 2, 4)
            nearby = self._count_nearby_gaps(gap, all_gaps, zone_meters=200.0)

            score = self._scorer.score(
                base_score=rule["risk"]["base_score"],
                trigger_confidence=trigger_conf,
                zone_context=zone_ctx,
                violation_count_in_zone=nearby,
            )

            findings.append(
                Finding(
                    finding_id=f"F-{str(uuid.uuid4())[:8].upper()}",
                    rule_id=rule["id"],
                    rule_name=rule["name"],
                    standard=rule["standard"],
                    risk_score=score.final_score,
                    risk_priority=score.risk_priority,
                    irap_stars=score.irap_stars,
                    irap_label=score.irap_label,
                    gap_start_sec=gap.gap_start_sec,
                    gap_end_sec=gap.gap_end_sec,
                    gap_duration_sec=gap.gap_duration_sec,
                    estimated_gap_meters=gap.estimated_gap_meters,
                    position_start_meters=gap.position_start_meters,
                    position_end_meters=gap.position_end_meters,
                    trigger_class=target,
                    trigger_confidence=trigger_conf,
                    recommended_action=rule["recommended_action"].strip(),
                    status="PENDING_REVIEW",
                    score_breakdown=asdict(score),
                )
            )

        return findings

    def _eval_co_presence(self, rule: dict, detections: pd.DataFrame) -> list[Finding]:
        """
        R-01 / R-02 / R-03 / R-04 / R-05 type: trigger class detected but
        required class is absent within a spatial window.
        (Skeleton — fully activates when required classes are added.)
        """
        return []   # Pending additional detection classes

    def _eval_context_co_presence(self, rule: dict, detections: pd.DataFrame) -> list[Finding]:
        """R-06 type: main entrance near ambulance entrance but no emergency sign."""
        return []   # Pending additional detection classes

    # ── Helpers ──────────────────────────────────────────────────

    def _count_nearby_gaps(
        self,
        target_gap: DetectionGap,
        all_gaps: list[DetectionGap],
        zone_meters: float = 200.0,
    ) -> int:
        """Count how many other gaps fall within zone_meters of target_gap."""
        mid = (target_gap.position_start_meters + target_gap.position_end_meters) / 2
        count = 0
        for g in all_gaps:
            g_mid = (g.position_start_meters + g.position_end_meters) / 2
            if abs(g_mid - mid) <= zone_meters:
                count += 1
        return max(1, count)

    def _load_yaml(self) -> dict:
        with open(self._rules_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    @staticmethod
    def _validate_df(df: pd.DataFrame) -> None:
        required = {"Object", "Confidence", "Timestamp_sec"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Detections DataFrame missing columns: {missing}")
