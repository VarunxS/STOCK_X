from __future__ import annotations

import json
import os
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from utils.openrouter import invoke_with_model_fallback
from utils.parsers import clean_llm_json

SYSTEM_PROMPT = """You are Verdict's scenario lab.

You help investment bankers and consultants test a proposed action or deal
thesis against grounded company context.

Use only the retrieved context and memo provided. Do not invent facts.
Return JSON only.

Required output schema:
{
  "proposal": "",
  "why_this_could_work": ["", ""],
  "expected_upside": ["", ""],
  "financial_impact": ["", ""],
  "strategic_impact": ["", ""],
  "operational_consequences": ["", ""],
  "risks_and_failure_modes": ["", ""],
  "stress_triggers_to_monitor": ["", ""],
  "recommendation": "",
  "evidence_used": [
    {
      "title": "",
      "url": "",
      "reason": ""
    }
  ]
}
"""


async def run_scenario_lab(
    memo: dict,
    retrieved_context: list[dict],
    proposal: str,
    objective: Optional[str] = None,
    horizon: Optional[str] = None,
    provider_type: str = "openrouter",
    model_name: Optional[str] = None,
    provider_order: Optional[list[str]] = None,
    strict_provider: bool = False,
    api_key: Optional[str] = None,
) -> dict:
    resolved_api_key = api_key or os.environ.get(
        {
            "openrouter": "OPENROUTER_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }.get(provider_type, "OPENROUTER_API_KEY"),
        "",
    )
    payload = {
        "proposal": proposal,
        "objective": objective,
        "horizon": horizon,
        "memo": memo,
        "retrieved_context": retrieved_context,
    }

    response = await invoke_with_model_fallback(
        messages=[
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=json.dumps(payload, default=str)),
        ],
        api_key=resolved_api_key,
        preferred_model=model_name,
        provider_type=provider_type,
        provider_order=provider_order,
        strict_provider=strict_provider,
        temperature=0.2,
    )
    parsed = clean_llm_json(str(response.content))

    def array_field(name: str) -> list[str]:
        return parsed.get(name, []) or []

    return {
        "proposal": parsed.get("proposal", proposal),
        "why_this_could_work": array_field("why_this_could_work"),
        "expected_upside": array_field("expected_upside"),
        "financial_impact": array_field("financial_impact"),
        "strategic_impact": array_field("strategic_impact"),
        "operational_consequences": array_field("operational_consequences"),
        "risks_and_failure_modes": array_field("risks_and_failure_modes"),
        "stress_triggers_to_monitor": array_field("stress_triggers_to_monitor"),
        "recommendation": parsed.get("recommendation", ""),
        "evidence_used": [
            {
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "reason": item.get("reason", ""),
            }
            for item in (parsed.get("evidence_used", []) or [])
        ],
    }
