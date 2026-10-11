"""
LangGraph State Machine — Verdict Analysis Pipeline.

Orchestrates the full n8n workflow as a directed graph:

  START
    ├── fetch_data_node (4 parallel FMP API calls)
    └── market_intel_node (query intelligence → Tavily searches)
         │
    ┌────┘
    ▼
  audit_node (data quality check on financial data)
    │
    ▼
  merge_node (combine market intel + financial data + audit)
    │
    ├── ib_analyst_node (Investment Banking IC memo)
    └── mc_analyst_node (McKinsey board deck)
         │
    ┌────┘
    ▼
  combine_results_node (merge both analyst outputs)
    │
    ▼
  END
"""

import asyncio
from typing import TypedDict

from langgraph.graph import StateGraph, START, END

from data.financial import fetch_all_financial_data
from tools.search import search_multiple
from agents.query_intelligence import run_query_intelligence
from agents.audit import run_audit
from agents.ib_analyst import run_ib_analyst
from agents.mc_analyst import run_mc_analyst


# ──────────────────────────────────────────────
# State definition
# ──────────────────────────────────────────────

class VerdictState(TypedDict):
    """State that flows through the graph."""
    ticker: str
    api_keys: dict
    provider_type: str
    model_name: str
    provider_order: list[str]
    strict_provider: bool
    financial_data: dict
    market_intel: list
    audit_result: dict
    merged_data: dict
    ib_output: dict
    mc_output: dict
    final_result: dict


# ──────────────────────────────────────────────
# Node functions
# ──────────────────────────────────────────────

async def fetch_data_node(state: VerdictState) -> dict:
    """
    Fetch all financial data in parallel.
    Mirrors: Webhook → BALANCE SHEET / INCOME STATEMENT / CASH FLOW / FINANCIAL RATIOS → Merge2 → Aggregate3
    """
    ticker = state["ticker"]
    print(f"[FETCH_DATA] Fetching financial data for {ticker}...")
    financial_data = await fetch_all_financial_data(ticker)
    print(f"[FETCH_DATA] ✓ Got data: {list(financial_data.keys())}")
    return {"financial_data": financial_data}


async def market_intel_node(state: VerdictState) -> dict:
    """
    Generate search queries and run Tavily searches.
    Mirrors: QUERY INTELLIGENCE AGENT → Split Out → Search → Aggregate1
    """
    ticker = state["ticker"]
    provider_type = state.get("provider_type", "openrouter")
    api_key = state.get("api_keys", {}).get(provider_type)
    model_name = state.get("model_name")
    provider_order = state.get("provider_order", [])
    strict_provider = state.get("strict_provider", False)
    print(f"[MARKET_INTEL] Generating search queries for {ticker}...")

    # Step 1: Generate queries
    query_result = await run_query_intelligence(
        ticker,
        provider_type=provider_type,
        model_name=model_name,
        provider_order=provider_order,
        strict_provider=strict_provider,
        api_key=api_key,
    )
    queries = [q["query"] for q in query_result.get("queries", [])]
    print(f"[MARKET_INTEL] Generated {len(queries)} queries: {queries}")

    # Step 2: Run all searches in parallel
    if queries:
        search_results = await search_multiple(queries)
        print(f"[MARKET_INTEL] ✓ Got {len(search_results)} search results")
    else:
        search_results = []
        print("[MARKET_INTEL] ⚠ No queries generated")

    return {"market_intel": search_results}


async def audit_node(state: VerdictState) -> dict:
    """
    Audit the financial data for quality issues.
    Mirrors: Aggregate3 → AUDIT AGENT → Code in JavaScript (parse)
    """
    financial_data = state["financial_data"]
    provider_type = state.get("provider_type", "openrouter")
    api_key = state.get("api_keys", {}).get(provider_type)
    model_name = state.get("model_name")
    provider_order = state.get("provider_order", [])
    strict_provider = state.get("strict_provider", False)
    print("[AUDIT] Running financial data audit...")
    audit_result = await run_audit(
        financial_data,
        provider_type=provider_type,
        model_name=model_name,
        provider_order=provider_order,
        strict_provider=strict_provider,
        api_key=api_key,
    )
    print(f"[AUDIT] ✓ Audit complete")
    return {"audit_result": audit_result}


async def merge_node(state: VerdictState) -> dict:
    """
    Merge all data sources into a single DATA payload.
    Mirrors: Merge (3 inputs) → Aggregate
    """
    financial_data = state.get("financial_data", {})
    financial_available = any(
        isinstance(financial_data.get(field), list) and bool(financial_data[field])
        or isinstance(financial_data.get(field), dict) and bool(financial_data[field]) and not financial_data[field].get("error") and "Error Message" not in financial_data[field]
        for field in ("balance_sheet", "income_statement", "cash_flow", "financial_ratios")
    )
    if not state.get("market_intel") and not financial_available:
        raise ValueError("Research data is unavailable. Configure TAVILY_API_KEY for research sources or FMP_API_KEY for financial statements before generating a memo.")
    merged = {
        "market_intelligence": state.get("market_intel", []),
        "financial_data": state.get("financial_data", {}),
        "audit_report": state.get("audit_result", {}),
    }
    print(f"[MERGE] ✓ Merged data keys: {list(merged.keys())}")
    return {"merged_data": merged}


async def ib_analyst_node(state: VerdictState) -> dict:
    """
    Run the Investment Banking analyst.
    Mirrors: Aggregate → Investment Banker Analyst → Code in JavaScript1
    """
    provider_type = state.get("provider_type", "openrouter")
    api_key = state.get("api_keys", {}).get(provider_type)
    model_name = state.get("model_name")
    provider_order = state.get("provider_order", [])
    strict_provider = state.get("strict_provider", False)
    print("[IB_ANALYST] Running Investment Banking analysis...")
    ib_output = await run_ib_analyst(
        state["merged_data"],
        provider_type=provider_type,
        model_name=model_name,
        provider_order=provider_order,
        strict_provider=strict_provider,
        api_key=api_key,
    )
    print("[IB_ANALYST] ✓ IB analysis complete")
    return {"ib_output": ib_output}


async def mc_analyst_node(state: VerdictState) -> dict:
    """
    Run the Management Consulting analyst.
    Mirrors: Aggregate → Consulting analyst → Code in JavaScript2
    """
    provider_type = state.get("provider_type", "openrouter")
    api_key = state.get("api_keys", {}).get(provider_type)
    model_name = state.get("model_name")
    provider_order = state.get("provider_order", [])
    strict_provider = state.get("strict_provider", False)
    print("[MC_ANALYST] Running Management Consulting analysis...")
    mc_output = await run_mc_analyst(
        state["merged_data"],
        provider_type=provider_type,
        model_name=model_name,
        provider_order=provider_order,
        strict_provider=strict_provider,
        api_key=api_key,
    )
    print("[MC_ANALYST] ✓ MC analysis complete")
    return {"mc_output": mc_output}


async def combine_results_node(state: VerdictState) -> dict:
    """
    Combine IB and MC outputs into the final response.
    Mirrors: Merge1 → Aggregate2 → Respond to Webhook1
    """
    final = {
        "ib_analysis": state.get("ib_output", {}),
        "mc_analysis": state.get("mc_output", {}),
    }
    print("[COMBINE] ✓ Final result assembled")
    return {"final_result": final}


# ──────────────────────────────────────────────
# Graph construction
# ──────────────────────────────────────────────

def build_graph() -> StateGraph:
    """
    Build and compile the LangGraph state machine.

    Graph topology:
      START → [fetch_data, market_intel] (parallel)
      fetch_data → audit
      [audit, market_intel] → merge (fan-in)
      merge → [ib_analyst, mc_analyst] (parallel)
      [ib_analyst, mc_analyst] → combine (fan-in)
      combine → END
    """
    graph = StateGraph(VerdictState)

    # Add nodes
    graph.add_node("fetch_data", fetch_data_node)
    graph.add_node("market_intel", market_intel_node)
    graph.add_node("audit", audit_node)
    graph.add_node("merge", merge_node)
    graph.add_node("ib_analyst", ib_analyst_node)
    graph.add_node("mc_analyst", mc_analyst_node)
    graph.add_node("combine", combine_results_node)

    # ── Phase 1: Parallel data collection ──
    # START fans out to both fetch_data and market_intel
    graph.add_edge(START, "fetch_data")
    graph.add_edge(START, "market_intel")

    # fetch_data → audit (audit needs financial data)
    graph.add_edge("fetch_data", "audit")

    # ── Phase 2: Merge (fan-in) ──
    # Both audit and market_intel must complete before merge
    graph.add_edge("audit", "merge")
    graph.add_edge("market_intel", "merge")

    # ── Phase 3: Parallel analysis ──
    # merge fans out to both analysts
    graph.add_edge("merge", "ib_analyst")
    graph.add_edge("merge", "mc_analyst")

    # ── Phase 4: Combine (fan-in) ──
    # Both analysts must complete before combining
    graph.add_edge("ib_analyst", "combine")
    graph.add_edge("mc_analyst", "combine")

    # combine → END
    graph.add_edge("combine", END)

    return graph.compile()


# Pre-compiled graph instance
verdict_graph = build_graph()
