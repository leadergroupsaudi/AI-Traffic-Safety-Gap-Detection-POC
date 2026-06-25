"""
Risk Scorer
-----------
Implements the 4-factor risk scoring formula:

    risk_score = BRS × DCF × ZCM × CVF   (clamped to [0, 100])

Where:
    BRS  — Base Risk Score           (from rule definition)
    DCF  — Detection Confidence Factor  (dampens borderline detections)
    ZCM  — Zone Criticality Multiplier  (higher near emergency assets)
    CVF  — Compound Violation Factor    (compounds when multiple gaps in zone)

iRAP star rating is derived from the final score.
"""

from __future__ import annotations
from dataclasses import dataclass


# ── iRAP thresholds ─────────────────────────────────────────────
IRAP_THRESHOLDS = [
    (75, 1, "Highest risk road"),
    (50, 2, "High risk road"),
    (25, 3, "Medium risk road"),
    (10, 4, "Low risk road"),
    (0,  5, "Safe road"),
]

# ── Classification labels ────────────────────────────────────────
CLASSIFICATION = [
    (75, "CRITICAL"),
    (50, "HIGH"),
    (25, "MEDIUM"),
    (0,  "LOW"),
]


@dataclass
class ScoreBreakdown:
    """Full breakdown of how the risk score was calculated."""
    raw_score: float
    final_score: int
    risk_priority: str
    irap_stars: int
    irap_label: str

    base_score: float           # BRS
    confidence_factor: float    # DCF
    zone_multiplier: float      # ZCM
    compound_factor: float      # CVF

    trigger_confidence: float
    violation_count_in_zone: int
    zone_context: str


class RiskScorer:
    """
    Calculates risk scores for detected safety gaps.

    Parameters
    ----------
    config : dict
        The `scoring` section from saudi_traffic_rules.yaml.
        Must contain `zone_multipliers` and `compound_factors`.
    """

    def __init__(self, config: dict):
        self._zone_mult = config.get("zone_multipliers", {})
        self._compound  = config.get("compound_factors", {})

    # ── Public API ───────────────────────────────────────────────

    def score(
        self,
        base_score: float,
        trigger_confidence: float,
        zone_context: str = "general_road",
        violation_count_in_zone: int = 1,
    ) -> ScoreBreakdown:
        """
        Compute the full risk score for a single finding.

        Parameters
        ----------
        base_score : float
            BRS from the rule definition (0–100).
        trigger_confidence : float
            Confidence of the detection that triggered the rule (0.0–1.0).
        zone_context : str
            One of the keys in `zone_multipliers`:
            'near_ambulance_entrance', 'near_emergency_sign',
            'near_main_entrance', 'general_road'.
        violation_count_in_zone : int
            How many rule violations exist in the same ~100m zone.
        """
        dcf  = self._dcf(trigger_confidence)
        zcm  = self._zcm(zone_context)
        cvf  = self._cvf(violation_count_in_zone)

        raw   = base_score * dcf * zcm * cvf
        final = int(min(100, round(raw)))

        priority    = self._classify(final)
        stars, label = self._irap(final)

        return ScoreBreakdown(
            raw_score=round(raw, 2),
            final_score=final,
            risk_priority=priority,
            irap_stars=stars,
            irap_label=label,
            base_score=base_score,
            confidence_factor=round(dcf, 4),
            zone_multiplier=zcm,
            compound_factor=cvf,
            trigger_confidence=round(trigger_confidence, 4),
            violation_count_in_zone=violation_count_in_zone,
            zone_context=zone_context,
        )

    # ── Factor calculations ──────────────────────────────────────

    def _dcf(self, confidence: float) -> float:
        """DCF = 0.5 + (confidence × 0.5)  — range [0.625, 1.0] for conf [0.25, 1.0]"""
        return round(0.5 + (confidence * 0.5), 4)

    def _zcm(self, zone_context: str) -> float:
        return self._zone_mult.get(zone_context, 1.0)

    def _cvf(self, count: int) -> float:
        if count >= 4:
            return self._compound.get("violations_4_plus", 1.6)
        key = f"violations_{count}"
        return self._compound.get(key, 1.0)

    def _classify(self, score: int) -> str:
        for threshold, label in CLASSIFICATION:
            if score >= threshold:
                return label
        return "LOW"

    def _irap(self, score: int) -> tuple[int, str]:
        for threshold, stars, label in IRAP_THRESHOLDS:
            if score >= threshold:
                return stars, label
        return 5, "Safe road"
