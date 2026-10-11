"""
Financial data fetching from Financial Modeling Prep API.

Replicates the 4 parallel HTTP requests from the n8n workflow:
  - Balance Sheet TTM
  - Income Statement TTM
  - Cash Flow Statement TTM
  - Financial Ratios (5-year)
"""
from __future__ import annotations

import os
import asyncio
import httpx
from typing import Any, Union
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from dotenv import load_dotenv

load_dotenv()

FMP_API_KEY = os.getenv("FMP_API_KEY")
FMP_BASE = "https://financialmodelingprep.com/stable"


async def _fetch(client: httpx.AsyncClient, url: str) -> Union[dict, list]:
    """Execute a single FMP API call and return parsed JSON."""
    resp = await client.get(url, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def _redact_url(url: str) -> str:
    parts = urlsplit(url)
    query = urlencode([(key, "[REDACTED]" if key.lower() == "apikey" else value) for key, value in parse_qsl(parts.query)])
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def _serialize_error(error: Exception) -> dict[str, Any]:
    payload = {
        "error": True,
        "type": error.__class__.__name__,
        "message": str(error),
    }
    if isinstance(error, httpx.HTTPStatusError):
        payload["status_code"] = error.response.status_code
        original_url = str(error.request.url)
        payload["url"] = _redact_url(original_url)
        payload["message"] = str(error).replace(original_url, payload["url"])
    return payload


def _symbol_candidates(ticker: str) -> list[str]:
    normalized = ticker.strip().upper()
    if "." in normalized:
        return [normalized]
    return [normalized, f"{normalized}.NS", f"{normalized}.BO"]


def _market_for_symbol(symbol: str) -> str:
    if symbol.endswith(".NS") or symbol.endswith(".BO"):
        return "india"
    return "us"


def _looks_populated(payload: Any) -> bool:
    if isinstance(payload, list):
        return len(payload) > 0
    if isinstance(payload, dict):
        return (
            len(payload) > 0
            and "Error Message" not in payload
            and payload.get("error") is not True
        )
    return False


def _build_urls(symbol: str, api_key: str | None) -> dict[str, str]:
    return {
        "balance_sheet": (
            f"{FMP_BASE}/balance-sheet-statement-ttm"
            f"?symbol={symbol}&period=annual&limit=1&apikey={api_key}"
        ),
        "income_statement": (
            f"{FMP_BASE}/income-statement-ttm"
            f"?symbol={symbol}&period=annual&limit=1&apikey={api_key}"
        ),
        "cash_flow": (
            f"{FMP_BASE}/cash-flow-statement-ttm"
            f"?symbol={symbol}&limit=1&apikey={api_key}"
        ),
        "financial_ratios": (
            f"{FMP_BASE}/ratios"
            f"?symbol={symbol}&apikey={api_key}"
        ),
    }


async def _fetch_symbol_bundle(
    client: httpx.AsyncClient,
    symbol: str,
    api_key: str | None
) -> dict[str, Any]:
    urls = _build_urls(symbol, api_key)
    payloads = await asyncio.gather(
        *(_fetch(client, url) for url in urls.values()),
        return_exceptions=True,
    )

    result: dict[str, Any] = {"symbol": symbol}
    for key, payload in zip(urls.keys(), payloads):
        result[key] = _serialize_error(payload) if isinstance(payload, Exception) else payload
    return result


async def fetch_all_financial_data(ticker: str, fmp_api_key: str | None = FMP_API_KEY) -> dict:
    """
    Run all 4 financial data fetches in parallel and resolve the best symbol.

    Returns a dict with keys:
      symbol_info, balance_sheet, income_statement, cash_flow, financial_ratios
    """
    normalized = ticker.strip().upper()
    fields = ("balance_sheet", "income_statement", "cash_flow", "financial_ratios")
    if not fmp_api_key:
        return {
            "symbol_info": {"input_ticker": normalized, "resolved_symbol": normalized, "market": "unknown", "resolution_status": "unconfirmed"},
            **{field: {"error": True, "type": "ConfigurationError", "message": "FMP_API_KEY is not configured"} for field in fields},
        }
    first_bundle: dict[str, Any] | None = None

    async with httpx.AsyncClient() as client:
        for symbol in _symbol_candidates(ticker):
            bundle = await _fetch_symbol_bundle(client, symbol, fmp_api_key)
            if first_bundle is None:
                first_bundle = bundle

            populated = any(
                _looks_populated(bundle[key])
                for key in ("balance_sheet", "income_statement", "cash_flow", "financial_ratios")
            )

            if populated:
                return {
                    "symbol_info": {
                        "input_ticker": ticker.strip().upper(),
                        "resolved_symbol": symbol,
                        "market": _market_for_symbol(symbol),
                        "resolution_status": "confirmed",
                    },
                    "balance_sheet": bundle["balance_sheet"],
                    "income_statement": bundle["income_statement"],
                    "cash_flow": bundle["cash_flow"],
                    "financial_ratios": bundle["financial_ratios"],
                }

    if first_bundle is None:
        raise RuntimeError("Financial data request failed before symbol resolution.")

    return {
        "symbol_info": {
            "input_ticker": ticker.strip().upper(),
            "resolved_symbol": normalized,
            "market": "unknown",
            "resolution_status": "unconfirmed",
        },
        "balance_sheet": first_bundle["balance_sheet"],
        "income_statement": first_bundle["income_statement"],
        "cash_flow": first_bundle["cash_flow"],
        "financial_ratios": first_bundle["financial_ratios"],
    }
