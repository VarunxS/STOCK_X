from __future__ import annotations

import json
import os
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from utils.openrouter import invoke_with_model_fallback
from utils.parsers import clean_llm_json

QA_SYSTEM_PROMPT = """You are STOCK X's DataPulse Agent — an advanced stock market investment and equity intelligence agent.

You serve both retail investors and institutional fund managers by providing sharp, data-backed stock analysis, market insights, and investment clarity about the company.

CORE STOCK MARKET EMPHASIS:
1. Focus on stock market fundamentals: revenue & earnings momentum, EPS trajectory, operating margins, valuation multiples (P/E, EV/EBITDA, P/B), free cash flow, and debt-to-equity health.
2. Highlight stock price catalysts: earnings surprises, quarterly guidance, market share gains/losses, dividend yields, capital allocation, buybacks, and sector tailwinds.
3. Address risk-reward skew: downside protection, balance sheet vulnerabilities, competitive moat durability, and key regulatory or macroeconomic headwinds.
4. Bridge retail accessibility and institutional depth: write clearly, explain key market drivers directly, and cite precise figures, percentages, dates, and disclosures without fluff or speculation.
5. Strict grounding: Base your answer strictly on the provided company memo, financial data, and retrieved market sources. If certain metrics or forward targets are unavailable in the context, explicitly acknowledge it.

OUTPUT FORMAT (JSON only, no markdown code block wrapping):
{
  "question": "<the user question>",
  "answer": "<clear, incisive, stock-market focused analysis answering the question with concrete metrics, price/earnings catalysts, and context>",
  "key_takeaways": [
    "<actionable market takeaway 1>",
    "<actionable market takeaway 2>",
    "<actionable market takeaway 3>"
  ],
  "evidence_used": [
    {
      "title": "<filing, statement, or source title>",
      "url": "<source url if available>",
      "reason": "<how this fact or disclosure backs the investment conclusion>"
    }
  ],
  "suggested_followups": [
    "<next logical stock question 1>",
    "<next logical stock question 2>",
    "<next logical stock question 3>"
  ]
}
"""

QUESTIONS_SYSTEM_PROMPT = """You are STOCK X's DataPulse Market Strategist.
Generate 5 high-impact, stock-market focused investment questions that both retail and institutional investors should ask about this stock.

Guidelines:
- Prioritize stock market drivers: valuation multiples vs peers, upcoming quarterly earnings catalysts, margin expansion/compression, dividend sustainability, balance sheet leverage, and competitive moats.
- Tailor specifically to the company's real financial disclosures, business model, and sector dynamics.
- Make them incisive, practical, and under 18 words each.

OUTPUT FORMAT (JSON only):
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5"
  ]
}
"""


def _default_questions(ticker: str, company_name: Optional[str] = None) -> list[str]:
    name = company_name or ticker
    return [
        f"What are the key stock market catalysts and earnings drivers for {name}?",
        f"How do current valuation multiples (P/E, EV/EBITDA) compare to sector peers?",
        f"What is the risk-reward profile and downside risk for investors holding {name}?",
        f"How sustainable are {name}'s operating margins and free cash flow generation?",
        f"What is management's guidance on revenue growth, Capex, and shareholder returns?",
    ]


async def generate_suggested_questions(
    ticker: str,
    memo: dict[str, Any],
    financial_data: Optional[dict[str, Any]] = None,
    provider_type: str = "openrouter",
    model_name: Optional[str] = None,
    provider_order: Optional[list[str]] = None,
    strict_provider: bool = False,
    api_key: Optional[str] = None,
) -> list[str]:
    resolved_api_key = api_key or os.environ.get(
        {
            "openrouter": "OPENROUTER_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }.get(provider_type, "OPENROUTER_API_KEY"),
        "",
    )

    company_name = memo.get("company_snapshot", {}).get("company", ticker)
    if not resolved_api_key:
        return _default_questions(ticker, company_name)

    context_summary = {
        "ticker": ticker,
        "company": company_name,
        "summary": memo.get("company_snapshot", {}).get("summary", ""),
        "core_thesis": memo.get("core_thesis", {}).get("summary", ""),
        "key_risks": memo.get("key_risks_and_stress_points", {}).get("bullets", [])[:3],
        "financial_constraints": memo.get("financial_quality_and_constraints", {}).get("bullets", [])[:3],
    }

    try:
        response = await invoke_with_model_fallback(
            messages=[
                SystemMessage(content=QUESTIONS_SYSTEM_PROMPT),
                HumanMessage(content=json.dumps(context_summary, default=str)),
            ],
            api_key=resolved_api_key,
            preferred_model=model_name,
            provider_type=provider_type,
            provider_order=provider_order,
            strict_provider=strict_provider,
            temperature=0.3,
        )
        parsed = clean_llm_json(str(response.content))
        questions = parsed.get("questions", [])
        if isinstance(questions, list) and len(questions) > 0:
            valid_questions = [str(q).strip() for q in questions if str(q).strip()]
            if len(valid_questions) >= 3:
                return valid_questions[:5]
    except Exception as error:
        print(f"[DATAPULSE AGENT] Failed to generate custom questions, using defaults: {error}")

    return _default_questions(ticker, company_name)


async def run_rag_qa(
    ticker: str,
    question: str,
    memo: dict[str, Any],
    retrieved_context: list[dict[str, Any]],
    chat_history: Optional[list[dict[str, Any]]] = None,
    provider_type: str = "openrouter",
    model_name: Optional[str] = None,
    provider_order: Optional[list[str]] = None,
    strict_provider: bool = False,
    api_key: Optional[str] = None,
) -> dict[str, Any]:
    resolved_api_key = api_key or os.environ.get(
        {
            "openrouter": "OPENROUTER_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }.get(provider_type, "OPENROUTER_API_KEY"),
        "",
    )

    payload = {
        "ticker": ticker,
        "question": question,
        "chat_history": (chat_history or [])[-4:],  # Keep recent turns for context
        "memo": memo,
        "retrieved_context": retrieved_context,
    }

    response = await invoke_with_model_fallback(
        messages=[
            SystemMessage(content=QA_SYSTEM_PROMPT),
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

    def list_field(field: str) -> list[str]:
        raw_items = parsed.get(field, [])
        if isinstance(raw_items, list):
            return [str(item).strip() for item in raw_items if str(item).strip()]
        return []

    evidence = []
    for item in parsed.get("evidence_used", []) or []:
        if isinstance(item, dict):
            evidence.append(
                {
                    "title": str(item.get("title", "")),
                    "url": str(item.get("url", "")),
                    "reason": str(item.get("reason", "")),
                }
            )

    # If no evidence parsed from LLM, surface top retrieved documents
    if not evidence and retrieved_context:
        for doc in retrieved_context[:3]:
            evidence.append(
                {
                    "title": doc.get("title", f"{ticker} Market Reference"),
                    "url": doc.get("metadata", {}).get("url", ""),
                    "reason": f"Retrieved source context ({doc.get('kind', 'source')}) with score {doc.get('score', 0):.2f}",
                }
            )

    answer_text = parsed.get("answer") or parsed.get("error_message") or str(response.content)

    return {
        "question": parsed.get("question", question),
        "answer": answer_text,
        "key_takeaways": list_field("key_takeaways"),
        "evidence_used": evidence,
        "suggested_followups": list_field("suggested_followups"),
    }
