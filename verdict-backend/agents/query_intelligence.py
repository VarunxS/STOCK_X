"""
Query Intelligence Agent.

Replicates the 'QUERY INTELLIGENCE AGENT' node from the n8n workflow.
Takes a stock ticker and generates 4-5 targeted search queries for
market intelligence gathering.

Uses OpenRouter with structured output to produce:
  { company_name, symbol, queries: [{ query, category }] }
"""

import json
import os
from langchain_core.messages import SystemMessage, HumanMessage
from utils.openrouter import invoke_with_model_fallback

SYSTEM_PROMPT = """You are a search query generator for public-company intelligence.

INPUT: A public-company name or ticker. The company may be listed in the US or India.

OUTPUT: Exactly 5 search queries. JSON only. Nothing else.

YOUR JOB:
Identify the company, its sector, likely geography, and its 2-3 closest listed peers.
Generate queries covering:
  - Company's recent catalysts
  - Industry and competitor developments
  - Filings / annual-report style context
  - Capital markets or regulatory context
  - Investor relations / management commentary

QUERY RULES:
  - Plain factual phrases, no questions
  - No adjectives, no speculation
  - Each query targets different information
  - 4-9 words per query maximum

OUTPUT FORMAT (JSON only, no markdown):
{
  "company_name": "STRING",
  "symbol": "STRING",
  "market": "US | INDIA | UNKNOWN",
  "queries": [
    {
      "query": "STRING",
      "category": "STRING"
    }
  ]
}"""


from typing import Optional

async def run_query_intelligence(
    ticker: str,
    provider_type: str = "openrouter",
    model_name: Optional[str] = None,
    provider_order: Optional[list[str]] = None,
    strict_provider: bool = False,
    api_key: Optional[str] = None,
) -> dict:
    """
    Generate search queries for market intelligence on the given ticker.

    Args:
        ticker: Stock ticker symbol (e.g., 'RELIANCE')
        provider_type: Selected inference provider.
        model_name: Model to use.
        api_key: User-provided API key. Falls back to provider env var.

    Returns:
        Dict with company_name, symbol, and list of query objects.
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
                f"YOU GET A PUBLIC COMPANY TICKER\n"
                f"I WANT YOU TO COMPLETE THE TASK DEFINED BY SYSTEM MESSAGE:\n\n"
                f"{ticker}"
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

    # Clean markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON in the response
        first = cleaned.find("{")
        last = cleaned.rfind("}")
        if first != -1 and last != -1:
            result = json.loads(cleaned[first : last + 1])
        else:
            raise ValueError(f"Failed to parse query intelligence output: {raw[:200]}")

    return result
