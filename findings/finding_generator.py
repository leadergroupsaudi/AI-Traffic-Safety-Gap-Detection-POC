# findings/finding_generator.py

import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # Reads .env file into environment


class RecommendationGenerator:

    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY", "")
        self.model   = os.environ.get("OPENAI_MODEL", "gpt-4o")

        if not self.api_key:
            print("[WARNING] OPENAI_API_KEY not set in .env — AI recommendations will be skipped.")
            self.client = None
        else:
            self.client = OpenAI(api_key=self.api_key)

    def generate(self, finding):

        # If no API key, skip AI and return finding unchanged
        if not self.client:
            finding["ai_recommendation"] = finding.get("recommended_action", "")
            return finding

        prompt = f"""You are a road safety expert aligned with Saudi MOMAH and KSARAP standards.

A road inspection AI detected the following safety issue:
- Finding   : {finding.get('rule_name', '')}
- Object    : {finding.get('trigger_class', '')}
- Severity  : {finding.get('risk_priority', '')}
- Risk Score: {finding.get('risk_score', 0)} / 100
- Duration  : {finding.get('gap_duration_sec', 0)} seconds visible in video
- First Seen: {finding.get('gap_start_sec', 0)}

Write a concise professional recommendation (3-4 sentences) for a municipal traffic engineer.
Include: what the issue is, why it is a safety risk, the corrective action, and urgency.
Write in plain paragraph form, no bullet points."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a road safety expert. Be concise and professional."},
                    {"role": "user",   "content": prompt}
                ],
                max_tokens=200,
                temperature=0.4,
            )

            finding["ai_recommendation"] = (
                response.choices[0].message.content.strip()
            )

        except Exception as e:
            print(f"[WARNING] OpenAI call failed for finding '{finding.get('finding', '')}': {e}")
            finding["ai_recommendation"] = finding.get("recommended_action", "")

        return finding
    


import uuid


class FindingGenerator:

    def generate(self, finding):

        finding["finding_id"] = str(uuid.uuid4())[:8]

        finding["review_status"] = "PENDING"

        finding["evidence_timestamp"] = round(
            (
                float(finding["first_seen_sec"])
                +
                float(finding["last_seen_sec"])
            ) / 2,
            2
        )

        if finding["risk_score"] >= 9:
            finding["risk_priority"] = "HIGH"

        elif finding["risk_score"] >= 6:
            finding["risk_priority"] = "MEDIUM"

        else:
            finding["risk_priority"] = "LOW"

        return finding