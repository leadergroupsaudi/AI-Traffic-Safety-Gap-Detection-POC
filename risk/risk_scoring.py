# risk/risk_scoring.py

class RiskScorer:

    severity_scores = {
        "HIGH": 9,
        "MEDIUM": 6,
        "LOW": 3
    }

    def calculate(self, finding):

        base_score = self.severity_scores[
            finding["severity"]
        ]

        duration_bonus = min(
            float(finding["duration_sec"]) / 10,
            1
        ) 

        risk_score = round(
            base_score + duration_bonus,
            2
        )

        finding["risk_score"] = risk_score

        return finding