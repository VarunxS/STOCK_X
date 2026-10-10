"""
Financial Data Audit Agent.

Replicates the 'AUDIT AGENT' node from the n8n workflow.
Checks data quality of financial statements and returns
structured audit findings.

Uses OpenRouter for LLM calls (OpenAI-compatible API).
"""

import json
import os
from langchain_core.messages import SystemMessage, HumanMessage
from utils.openrouter import invoke_with_model_fallback

SYSTEM_PROMPT = """You are a financial data quality checker.
Analyze the financial statements and return only this JSON:

{
  "company": "",
  "years_audited": [],
  "missing_fields": [{"year": "", "field": "", "statement": "", "impact": ""}],
  "cross_statement": {
    "net_income_match": "PASS or FAIL",
    "balance_sheet_equation": "PASS or FAIL"
  },
  "anomalies": [{"type": "", "severity": "HIGH or MEDIUM or LOW", "year": "", "note": ""}]
}

No markdown. No explanation. JSON only."""


from typing import Optional

async def run_audit(
    financial_data: dict,
    provider_type: str = "openrouter",
    model_name: Optional[str] = None,
    provider_order: Optional[list[str]] = None,
    strict_provider: bool = False,
    api_key: Optional[str] = None,
) -> dict:
    """
    Audit raw financial data for quality issues.

    Args:
        financial_data: Dict containing balance_sheet, income_statement,
                       cash_flow, financial_ratios.
        provider_type: Selected inference provider.
        model_name: Model to use for the audit.
        api_key: User-provided API key. Falls back to provider env var when available.

    Returns:
        Structured audit dict with data quality flags.
    """
    resolved_api_key = api_key or os.environ.get(
        {
            "openrouter": "OPENROUTER_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }.get(provider_type, "OPENROUTER_API_KEY"),
        "",
    )
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Audit the following financial data and return JSON only:\n\n"
                f"{json.dumps(financial_data, default=str)}"
            )
        ),
    ]

    response = await invoke_with_model_fallback(
        messages=messages,
        api_key=resolved_api_key,
        preferred_model=model_name,
        provider_type=provider_type,
        provider_order=provider_order,
        strict_provider=strict_provider,
        temperature=0,
    )
    raw = response.content

    # Clean markdown fences
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        first = cleaned.find("{")
        last = cleaned.rfind("}")
        if first != -1 and last != -1:
            try:
                return json.loads(cleaned[first : last + 1])
            except json.JSONDecodeError:
                pass
        return {
            "error": True,
            "error_message": "Audit JSON parse failed",
            "raw_output": raw[:500],
        }
