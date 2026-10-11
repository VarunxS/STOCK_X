"""
Tavily search wrapper for market intelligence.

Replicates the Tavily search node from the n8n workflow with the same
domain restrictions, expanded for India and US public-company coverage.
"""
from __future__ import annotations

import os
import asyncio
from tavily import AsyncTavilyClient
from dotenv import load_dotenv

load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# Expanded whitelist for public-company research and filings.
INCLUDE_DOMAINS = [
    "reuters.com",
    "business-standard.com",
    "livemint.com",
    "economictimes.indiatimes.com",
    "nseindia.com",
    "bseindia.com",
    "sebi.gov.in",
    "sec.gov",
    "annualreports.com",
    "investor.apple.com",
    "investor.microsoft.com",
    "investor.tesla.com",
]


async def search_query(query: str) -> dict:
    """
    Run a single Tavily search with domain restrictions.

    Returns the raw Tavily response dict with 'results' list.
    """
    client = AsyncTavilyClient(api_key=TAVILY_API_KEY)
    response = await client.search(
        query=query,
        search_depth="advanced",
        max_results=5,
        include_domains=INCLUDE_DOMAINS,
        topic="general",
    )
    return response


async def search_multiple(queries: list[str]) -> list[dict]:
    """
    Run multiple Tavily searches concurrently.
    Mirrors the n8n pattern: Split Out → Search (loop) → Aggregate1.

    Returns a list of all search results aggregated.
    """
    if not TAVILY_API_KEY:
        print("[SEARCH WARNING] TAVILY_API_KEY is not configured; research sources are unavailable")
        return []
    tasks = [search_query(q) for q in queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    aggregated = []
    for r in results:
        if isinstance(r, Exception):
            print(f"[SEARCH WARNING] Query failed: {r}")
            continue
        if isinstance(r, dict) and "results" in r:
            aggregated.extend(r["results"])
        elif isinstance(r, dict):
            aggregated.append(r)

    return aggregated
