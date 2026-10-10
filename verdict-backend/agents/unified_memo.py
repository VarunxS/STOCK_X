from __future__ import annotations

import json
import os
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from utils.openrouter import invoke_with_model_fallback
from utils.parsers import clean_llm_json

SYSTEM_PROMPT = """You are a senior strategy and capital-markets advisor.

Your job is to combine investment banking and consulting analysis into one
concise decision memo for a professional user.

Return JSON only. No markdown.

The memo must feel like one integrated point of view, not two stitched reports.
Use the evidence provided. Prefer sharp synthesis over exhaustive explanation.

Required sections:
- company_snapshot
- core_thesis
- market_and_competitive_position
- financial_quality_and_constraints
- key_risks_and_stress_points
- recommended_next_moves
- evidence_and_sources

Output schema:
{
  "title": "",
  "company_snapshot": {
    "company": "",
    "ticker": "",
    "sector": "",
    "market": "",
    "summary": "",
    "highlights": ["", ""]
  },
  "core_thesis": {
    "summary": "",
    "bullets": ["", ""]
  },
  "market_and_competitive_position": {
    "summary": "",
    "bullets": ["", ""]
  },
  "financial_quality_and_constraints": {
    "summary": "",
    "bullets": ["", ""]
  },
  "key_risks_and_stress_points": {
    "summary": "",
    "bullets": ["", ""]
  },
  "recommended_next_moves": {
    "summary": "",
    "bullets": ["", ""]
  },
  "evidence_and_sources": [
    {
      "title": "",
      "url": "",
      "relevance": ""
    }
  ]
}
"""


async def run_unified_memo(
    ticker: str,
    merged_data: dict,
    ib_output: dict,
    mc_output: dict,
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
    response = await invoke_with_model_fallback(
        messages=[
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(
                content=json.dumps(
                    {
                        "ticker": ticker,
                        "merged_data": merged_data,
                        "investment_analysis": ib_output,
                        "consulting_analysis": mc_output,
                    },
                    default=str,
                )
            ),
        ],
        api_key=resolved_api_key,
        preferred_model=model_name,
        provider_type=provider_type,
        provider_order=provider_order,
        strict_provider=strict_provider,
        temperature=0.2,
    )

    parsed = clean_llm_json(str(response.content))
    company_snapshot = parsed.get("company_snapshot", {}) or {}

    def section(name: str) -> dict:
        value = parsed.get(name, {}) or {}
        return {
            "summary": value.get("summary", ""),
            "bullets": value.get("bullets", []) or [],
        }

    return {
        "title": parsed.get("title", f"{ticker} Decision Memo"),
        "company_snapshot": {
            "company": company_snapshot.get("company", ""),
            "ticker": company_snapshot.get("ticker", ticker),
            "sector": company_snapshot.get("sector", ""),
            "market": company_snapshot.get("market", ""),
            "summary": company_snapshot.get("summary", ""),
            "highlights": company_snapshot.get("highlights", []) or [],
        },
        "core_thesis": section("core_thesis"),
        "market_and_competitive_position": section("market_and_competitive_position"),
        "financial_quality_and_constraints": section("financial_quality_and_constraints"),
        "key_risks_and_stress_points": section("key_risks_and_stress_points"),
        "recommended_next_moves": section("recommended_next_moves"),
        "evidence_and_sources": [
            {
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "relevance": item.get("relevance", ""),
            }
            for item in (parsed.get("evidence_and_sources", []) or [])
        ],
    }
