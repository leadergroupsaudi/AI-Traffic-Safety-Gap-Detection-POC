"""
Spatial Indexer
---------------
Converts timestamp-based detections into spatial events and finds
gaps between detections of a given class.

Since the POC has no GPS, distance is estimated from:
  distance_m = timestamp_sec * (vehicle_speed_kmh / 3.6)
"""

from __future__ import annotations
import pandas as pd
from dataclasses import dataclass, field


@dataclass
class DetectionGap:
    """A temporal/spatial gap between two consecutive valid detections."""
    gap_start_sec: float
    gap_end_sec: float
    gap_duration_sec: float
    estimated_gap_meters: float
    position_start_meters: float
    position_end_meters: float
    # Last confidence before the gap and first confidence after
    confidence_before: float = 0.0
    confidence_after: float = 0.0


@dataclass
class CoverageStats:
    """Summary statistics for a class over the entire video."""
    total_detections: int
    unique_timestamps: int
    avg_confidence: float
    max_confidence: float
    min_confidence: float
    covered_timestamps: int
    total_timestamps: int
    coverage_percent: float
    video_duration_sec: float


class SpatialIndexer:
    """
    Groups detection data by class and finds spatial gaps.

    Parameters
    ----------
    vehicle_speed_kmh : float
        Assumed vehicle speed for timestamp → distance conversion.
    """

    def __init__(self, vehicle_speed_kmh: float = 40.0):
        self.speed_ms = vehicle_speed_kmh / 3.6

    def timestamp_to_meters(self, timestamp_sec: float) -> float:
        return round(timestamp_sec * self.speed_ms, 2)

    # ── Public API ──────────────────────────────────────────────

    def find_gaps(
        self,
        detections: pd.DataFrame,
        target_class: str,
        min_confidence: float = 0.25,
        min_gap_seconds: float = 3.6,
    ) -> list[DetectionGap]:
        """
        Find all gaps in `target_class` detections that exceed `min_gap_seconds`.

        A gap is defined as a period where no detection of `target_class`
        above `min_confidence` exists.

        Returns a list of DetectionGap objects sorted by start time.
        """
        df = self._filter(detections, target_class, min_confidence)
        if df.empty:
            return []

        # One entry per unique timestamp — we only care whether the class
        # was seen, not how many times per frame.
        timestamps = sorted(df["Timestamp_sec"].unique())
        confidences = (
            df.groupby("Timestamp_sec")["Confidence"].max().to_dict()
        )

        gaps: list[DetectionGap] = []
        for i in range(1, len(timestamps)):
            prev_t = timestamps[i - 1]
            curr_t = timestamps[i]
            gap_sec = round(curr_t - prev_t, 3)

            if gap_sec >= min_gap_seconds:
                gaps.append(
                    DetectionGap(
                        gap_start_sec=round(prev_t, 3),
                        gap_end_sec=round(curr_t, 3),
                        gap_duration_sec=gap_sec,
                        estimated_gap_meters=round(gap_sec * self.speed_ms, 1),
                        position_start_meters=self.timestamp_to_meters(prev_t),
                        position_end_meters=self.timestamp_to_meters(curr_t),
                        confidence_before=round(confidences.get(prev_t, 0.0), 4),
                        confidence_after=round(confidences.get(curr_t, 0.0), 4),
                    )
                )

        return gaps

    def coverage_stats(
        self,
        detections: pd.DataFrame,
        target_class: str,
        min_confidence: float = 0.25,
    ) -> CoverageStats:
        """Return coverage statistics for a class across the whole video."""
        df = self._filter(detections, target_class, min_confidence)
        all_timestamps = detections["Timestamp_sec"].unique()

        if df.empty:
            return CoverageStats(
                total_detections=0,
                unique_timestamps=0,
                avg_confidence=0.0,
                max_confidence=0.0,
                min_confidence=0.0,
                covered_timestamps=0,
                total_timestamps=len(all_timestamps),
                coverage_percent=0.0,
                video_duration_sec=round(
                    float(detections["Timestamp_sec"].max()
                          - detections["Timestamp_sec"].min()), 2
                ),
            )

        covered = df["Timestamp_sec"].nunique()
        total = len(all_timestamps)

        return CoverageStats(
            total_detections=len(df),
            unique_timestamps=covered,
            avg_confidence=round(float(df["Confidence"].mean()), 4),
            max_confidence=round(float(df["Confidence"].max()), 4),
            min_confidence=round(float(df["Confidence"].min()), 4),
            covered_timestamps=covered,
            total_timestamps=total,
            coverage_percent=round(covered / total * 100, 1),
            video_duration_sec=round(
                float(detections["Timestamp_sec"].max()
                      - detections["Timestamp_sec"].min()), 2
            ),
        )

    def get_all_classes(self, detections: pd.DataFrame) -> list[str]:
        """Return sorted list of unique detected classes."""
        return sorted(detections["Object"].unique().tolist())

    def classes_present_in_window(
        self,
        detections: pd.DataFrame,
        start_sec: float,
        end_sec: float,
        min_confidence: float = 0.25,
    ) -> dict[str, float]:
        """
        Return {class_name: max_confidence} for all classes detected
        in the time window [start_sec, end_sec].
        """
        mask = (
            (detections["Timestamp_sec"] >= start_sec)
            & (detections["Timestamp_sec"] <= end_sec)
            & (detections["Confidence"] >= min_confidence)
        )
        window = detections[mask]
        if window.empty:
            return {}
        return (
            window.groupby("Object")["Confidence"]
            .max()
            .round(4)
            .to_dict()
        )

    # ── Private ─────────────────────────────────────────────────

    def _filter(
        self,
        detections: pd.DataFrame,
        target_class: str,
        min_confidence: float,
    ) -> pd.DataFrame:
        return detections[
            (detections["Object"] == target_class)
            & (detections["Confidence"] >= min_confidence)
        ].copy()
