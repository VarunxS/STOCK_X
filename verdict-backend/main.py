"""
STOCK X Backend — FastAPI Server + CLI.

Supports both API server and CLI mode:
  python main.py --ticker RELIANCE
"""
from __future__ import annotations

import json
import sys

# Windows terminals may default to an encoding that cannot print agent status messages.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

import asyncio
import argparse
from typing import Any, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv

# Load environment variables before any other imports
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from agents.qa_agent import generate_suggested_questions, run_rag_qa
from agents.scenario_lab import run_scenario_lab
from agents.unified_memo import run_unified_memo
from graph import verdict_graph
from services.export_docx import build_workspace_docx
from services.retrieval import (
    build_coverage_status,
    build_retrieval_index,
    build_source_summary,
    build_workspace_documents,
    retrieve_context,
)
from services.workspace_store import create_workspace, get_workspace, update_workspace


# ──────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────

app = FastAPI(
    title="STOCK X Analysis API",
    description="Investment Intelligence Platform for Retail & Institutional Investors with DataPulse Agent",
    version="2.0.0",
)

# CORS — allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApiKeys(BaseModel):
    """User-provided API keys (BYOK)."""
    openrouter: Optional[str] = None
    openai: Optional[str] = None
    gemini: Optional[str] = None


class AnalysisRequest(BaseModel):
    """Base request body."""
    ticker: str
    api_keys: Optional[ApiKeys] = None
    provider_type: str = "openrouter"
    model_name: Optional[str] = None
    provider_order: list[str] = Field(default_factory=list)
    strict_provider: bool = False


class QARequest(BaseModel):
    workspace_id: str
    question: str
    chat_history: list[dict[str, Any]] = Field(default_factory=list)
    api_keys: Optional[ApiKeys] = None
    provider_type: str = "openrouter"
    model_name: Optional[str] = None
    provider_order: list[str] = Field(default_factory=list)
    strict_provider: bool = False


class QuestionsRequest(BaseModel):
    workspace_id: str
    api_keys: Optional[ApiKeys] = None
    provider_type: str = "openrouter"
    model_name: Optional[str] = None
    provider_order: list[str] = Field(default_factory=list)
    strict_provider: bool = False


class ScenarioRequest(BaseModel):
    workspace_id: str
    proposal: str
    objective: Optional[str] = None
    horizon: Optional[str] = None
    api_keys: Optional[ApiKeys] = None
    provider_type: str = "openrouter"
    model_name: Optional[str] = None
    provider_order: list[str] = Field(default_factory=list)
    strict_provider: bool = False


class WorkspaceRequest(BaseModel):
    workspace_id: str


def _keys_dict(api_keys: Optional[ApiKeys]) -> dict[str, str]:
    keys: dict[str, str] = {}
    if api_keys and api_keys.openrouter:
        keys["openrouter"] = api_keys.openrouter
    if api_keys and api_keys.openai:
        keys["openai"] = api_keys.openai
    if api_keys and api_keys.gemini:
        keys["gemini"] = api_keys.gemini
    return keys


def _selected_api_key(keys: dict[str, str], provider_type: str) -> Optional[str]:
    return keys.get(provider_type)


def _build_initial_state(
    ticker: str,
    keys: dict[str, str],
    provider_type: str = "openrouter",
    model_name: Optional[str] = None,
    provider_order: Optional[list[str]] = None,
    strict_provider: bool = False,
) -> dict[str, Any]:
    return {
        "ticker": ticker,
        "api_keys": keys,
        "provider_type": provider_type,
        "model_name": (model_name or "").strip(),
        "provider_order": provider_order or [],
        "strict_provider": strict_provider,
        "financial_data": {},
        "market_intel": [],
        "audit_result": {},
        "merged_data": {},
        "ib_output": {},
        "mc_output": {},
        "final_result": {},
    }


def _normalize_sources(market_intel: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result in market_intel:
        url = result.get("url") or ""
        if url and url in seen:
            continue
        if url:
            seen.add(url)
        normalized.append(
            {
                "title": result.get("title") or "Untitled source",
                "url": url,
                "published": result.get("published_date") or result.get("publishedDate") or "Unknown",
                "domain": urlparse(url).netloc if url else "",
                "snippet": (result.get("content") or result.get("snippet") or "")[:320],
            }
        )
    return normalized[:12]


async def _build_workspace_payload(
    ticker: str,
    keys: dict[str, str],
    provider_type: str = "openrouter",
    model_name: Optional[str] = None,
    provider_order: Optional[list[str]] = None,
    strict_provider: bool = False,
) -> dict[str, Any]:
    result = await verdict_graph.ainvoke(
        _build_initial_state(ticker, keys, provider_type, model_name, provider_order, strict_provider)
    )

    memo = await run_unified_memo(
        ticker=ticker,
        merged_data=result["merged_data"],
        ib_output=result["ib_output"],
        mc_output=result["mc_output"],
        provider_type=provider_type,
        model_name=model_name,
        provider_order=provider_order or [],
        strict_provider=strict_provider,
        api_key=keys.get(provider_type),
    )

    sources = _normalize_sources(result.get("market_intel", []))
    source_summary = build_source_summary(sources)
    coverage_status = build_coverage_status(result["financial_data"], source_summary)
    retrieval_docs = build_workspace_documents(
        ticker=ticker,
        financial_data=result["financial_data"],
        market_intel=result.get("market_intel", []),
        memo=memo,
        ib_output=result["ib_output"],
        mc_output=result["mc_output"],
    )
    retrieval_index = build_retrieval_index(retrieval_docs)

    # Generate initial suggested questions grounded in the company memo and financials
    suggested_questions = await generate_suggested_questions(
        ticker=ticker,
        memo=memo,
        financial_data=result.get("financial_data"),
        provider_type=provider_type,
        model_name=model_name,
        provider_order=provider_order,
        strict_provider=strict_provider,
        api_key=keys.get(provider_type),
    )

    workspace = create_workspace(
        {
            "ticker": ticker,
            "memo": memo,
            "sources": sources,
            "source_summary": source_summary,
            "coverage_status": coverage_status,
            "retrieval_index": retrieval_index,
            "qa_history": [],
            "suggested_questions": suggested_questions,
            "latest_scenario": None,
        }
    )

    return {
        "workspaceId": workspace["workspace_id"],
        "memo": memo,
        "sourceSummary": source_summary,
        "coverageStatus": coverage_status,
        "sources": sources,
        "suggestedQuestions": suggested_questions,
        "expiresAt": workspace["expires_at"],
    }


@app.post("/verdict-analysis-tool")
async def analyze(request: AnalysisRequest):
    """
    Run the full STOCK X analysis pipeline.
    """
    ticker = request.ticker.strip().upper()
    provider_type = request.provider_type.strip().lower()

    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    if not request.model_name or not request.model_name.strip():
        raise HTTPException(status_code=400, detail="Inference model is required")
    keys = _keys_dict(request.api_keys)
    if not _selected_api_key(keys, provider_type):
        raise HTTPException(status_code=400, detail=f"API key is required for provider: {provider_type}")

    print(f"\n{'='*60}")
    print(f"  STOCK X ANALYSIS — {ticker}")
    print(f"{'='*60}\n")

    try:
        result = await verdict_graph.ainvoke(
            _build_initial_state(
                ticker,
                keys,
                provider_type,
                request.model_name,
                request.provider_order,
                request.strict_provider,
            )
        )

        print(f"\n{'='*60}")
        print(f"  ANALYSIS COMPLETE — {ticker}")
        print(f"{'='*60}\n")

        return result["final_result"]

    except Exception as e:
        print(f"\n[ERROR] Pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/workspace/analyze")
async def workspace_analyze(request: AnalysisRequest):
    ticker = request.ticker.strip().upper()
    provider_type = request.provider_type.strip().lower()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    if not request.model_name or not request.model_name.strip():
        raise HTTPException(status_code=400, detail="Inference model is required")
    keys = _keys_dict(request.api_keys)
    if not _selected_api_key(keys, provider_type):
        raise HTTPException(status_code=400, detail=f"API key is required for provider: {provider_type}")

    try:
        return await _build_workspace_payload(
            ticker,
            keys,
            provider_type,
            request.model_name,
            request.provider_order,
            request.strict_provider,
        )
    except Exception as error:
        print(f"\n[ERROR] Workspace analyze failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.post("/workspace/qa")
async def workspace_qa(request: QARequest):
    """
    DataPulse Agent: Answers any user question regarding the stock using vector & lexical context retrieval.
    """
    workspace = get_workspace(request.workspace_id)
    provider_type = request.provider_type.strip().lower()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace expired or not found")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    if not request.model_name or not request.model_name.strip():
        raise HTTPException(status_code=400, detail="Inference model is required")

    keys = _keys_dict(request.api_keys)
    if not _selected_api_key(keys, provider_type):
        raise HTTPException(status_code=400, detail=f"API key is required for provider: {provider_type}")

    try:
        retrieved = retrieve_context(
            workspace["retrieval_index"],
            request.question.strip(),
            top_k=6,
        )
        qa_result = await run_rag_qa(
            ticker=workspace["ticker"],
            question=request.question.strip(),
            memo=workspace["memo"],
            retrieved_context=retrieved,
            chat_history=request.chat_history,
            provider_type=provider_type,
            model_name=request.model_name,
            provider_order=request.provider_order,
            strict_provider=request.strict_provider,
            api_key=keys.get(provider_type),
        )

        # Update history in workspace
        current_history = workspace.get("qa_history") or []
        current_history.append(qa_result)
        update_workspace(request.workspace_id, {"qa_history": current_history})

        return {
            "workspaceId": request.workspace_id,
            "interaction": qa_result,
            "qaHistory": current_history,
            "retrievedContext": [
                {
                    "title": item.get("title", ""),
                    "kind": item.get("kind", ""),
                    "score": item.get("score", 0),
                    "url": item.get("metadata", {}).get("url", ""),
                }
                for item in retrieved
            ],
            "expiresAt": workspace["expires_at"],
        }
    except Exception as error:
        print(f"\n[ERROR] RAG QA failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.post("/workspace/suggest-questions")
async def workspace_suggest_questions(request: QuestionsRequest):
    """
    Generate dynamic company questions on demand.
    """
    workspace = get_workspace(request.workspace_id)
    provider_type = request.provider_type.strip().lower()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace expired or not found")

    if not request.model_name or not request.model_name.strip():
        raise HTTPException(status_code=400, detail="Inference model is required")
    keys = _keys_dict(request.api_keys)
    if not _selected_api_key(keys, provider_type):
        raise HTTPException(status_code=400, detail=f"API key is required for provider: {provider_type}")
    questions = await generate_suggested_questions(
        ticker=workspace["ticker"],
        memo=workspace["memo"],
        provider_type=provider_type,
        model_name=request.model_name,
        provider_order=request.provider_order,
        strict_provider=request.strict_provider,
        api_key=keys.get(provider_type),
    )
    update_workspace(request.workspace_id, {"suggested_questions": questions})
    return {"workspaceId": request.workspace_id, "suggestedQuestions": questions}


@app.post("/workspace/scenario")
async def workspace_scenario(request: ScenarioRequest):
    """Legacy scenario endpoint kept for compatibility."""
    workspace = get_workspace(request.workspace_id)
    provider_type = request.provider_type.strip().lower()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace expired or not found")
    if not request.proposal.strip():
        raise HTTPException(status_code=400, detail="Proposal is required")
    if not request.model_name or not request.model_name.strip():
        raise HTTPException(status_code=400, detail="Inference model is required")

    keys = _keys_dict(request.api_keys)
    if not _selected_api_key(keys, provider_type):
        raise HTTPException(status_code=400, detail=f"API key is required for provider: {provider_type}")
    try:
        retrieved = retrieve_context(
            workspace["retrieval_index"],
            " ".join(
                part for part in [request.proposal, request.objective or "", request.horizon or ""] if part
            ),
        )
        scenario = await run_scenario_lab(
            memo=workspace["memo"],
            retrieved_context=retrieved,
            proposal=request.proposal.strip(),
            objective=request.objective,
            horizon=request.horizon,
            provider_type=provider_type,
            model_name=request.model_name,
            provider_order=request.provider_order,
            strict_provider=request.strict_provider,
            api_key=keys.get(provider_type),
        )
        update_workspace(request.workspace_id, {"latest_scenario": scenario})
        return {
            "workspaceId": request.workspace_id,
            "scenario": scenario,
            "retrievedContext": [
                {
                    "title": item.get("title", ""),
                    "kind": item.get("kind", ""),
                    "score": item.get("score", 0),
                    "url": item.get("metadata", {}).get("url", ""),
                }
                for item in retrieved
            ],
            "expiresAt": workspace["expires_at"],
        }
    except Exception as error:
        print(f"\n[ERROR] Scenario lab failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.post("/workspace/clear-history")
async def workspace_clear_history(request: WorkspaceRequest):
    workspace = update_workspace(request.workspace_id, {"qa_history": []})
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace expired or not found")
    return {"workspaceId": request.workspace_id, "qaHistory": []}


@app.post("/workspace/export")
async def workspace_export(request: WorkspaceRequest):
    workspace = get_workspace(request.workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace expired or not found")

    try:
        document_bytes = build_workspace_docx(workspace)
        return {
            "filename": f"stockx-{workspace['ticker'].lower()}-workspace.docx",
            "content": document_bytes.hex(),
        }
    except Exception as error:
        print(f"\n[ERROR] Export failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "stock-x-backend"}


# ──────────────────────────────────────────────
# CLI mode
# ──────────────────────────────────────────────

async def run_cli(ticker: str):
    """Run analysis from the command line and print JSON output."""
    print(f"\n{'='*60}")
    print(f"  STOCK X ANALYSIS — {ticker}")
    print(f"{'='*60}\n")

    result = await verdict_graph.ainvoke(_build_initial_state(ticker.strip().upper(), {}))

    print(f"\n{'='*60}")
    print(f"  ANALYSIS COMPLETE — {ticker}")
    print(f"{'='*60}\n")

    print(json.dumps(result["final_result"], indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="STOCK X Analysis Backend")
    parser.add_argument("--ticker", type=str, help="Stock ticker to analyze (CLI mode)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind server to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind server to")
    args = parser.parse_args()

    if args.ticker:
        asyncio.run(run_cli(args.ticker))
    else:
        print("\nStarting STOCK X Analysis API on http://0.0.0.0:8000")
        print("Docs available at http://localhost:8000/docs\n")
        uvicorn.run("main:app", host=args.host, port=args.port, reload=True)
