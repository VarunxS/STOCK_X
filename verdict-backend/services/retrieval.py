from __future__ import annotations

import json
import math
import re
from typing import Any
from urllib.parse import urlparse

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_EMBEDDING_MODEL: Any | None = None
_EMBEDDING_UNAVAILABLE_REASON: str | None = None


def _get_embedding_model():
    global _EMBEDDING_MODEL, _EMBEDDING_UNAVAILABLE_REASON
    if _EMBEDDING_UNAVAILABLE_REASON is not None:
        return None
    if _EMBEDDING_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
            _EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as error:  # pragma: no cover - runtime environment dependent
            _EMBEDDING_UNAVAILABLE_REASON = str(error)
            print(f"[RETRIEVAL] Embeddings unavailable, falling back to lexical retrieval: {error}")
            return None
    return _EMBEDDING_MODEL


def _json_text(payload: Any, max_chars: int = 1600) -> str:
    raw = json.dumps(payload, ensure_ascii=True, default=str)
    return raw[:max_chars]


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _chunk_text(text: str, chunk_size: int = 900) -> list[str]:
    cleaned = _clean_text(text)
    if not cleaned:
        return []
    return [cleaned[index:index + chunk_size] for index in range(0, len(cleaned), chunk_size)]


def build_workspace_documents(
    ticker: str,
    financial_data: dict[str, Any],
    market_intel: list[dict[str, Any]],
    memo: dict[str, Any],
    ib_output: dict[str, Any],
    mc_output: dict[str, Any],
) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []

    def add_doc(text: str, kind: str, title: str, metadata: dict[str, Any] | None = None) -> None:
        for index, chunk in enumerate(_chunk_text(text)):
            documents.append(
                {
                    "id": f"{kind}-{len(documents)}",
                    "kind": kind,
                    "title": title,
                    "text": chunk,
                    "metadata": {"chunk": index, **(metadata or {})},
                }
            )

    add_doc(
        _json_text(financial_data, max_chars=2400),
        "financial-data",
        f"{ticker} financial data",
        {"ticker": ticker},
    )
    add_doc(
        _json_text(ib_output, max_chars=2400),
        "ib-analysis",
        f"{ticker} investment analysis",
        {"ticker": ticker},
    )
    add_doc(
        _json_text(mc_output, max_chars=2400),
        "mc-analysis",
        f"{ticker} consulting analysis",
        {"ticker": ticker},
    )

    memo_text = "\n".join(
        [
            memo.get("title", ""),
            memo.get("company_snapshot", {}).get("summary", ""),
            memo.get("core_thesis", {}).get("summary", ""),
            "\n".join(memo.get("market_and_competitive_position", {}).get("bullets", [])),
            "\n".join(memo.get("financial_quality_and_constraints", {}).get("bullets", [])),
            "\n".join(memo.get("key_risks_and_stress_points", {}).get("bullets", [])),
            "\n".join(memo.get("recommended_next_moves", {}).get("bullets", [])),
        ]
    )
    add_doc(memo_text, "memo", f"{ticker} decision memo", {"ticker": ticker})

    for result in market_intel:
        title = result.get("title") or "Untitled source"
        url = result.get("url") or ""
        published = result.get("published_date") or result.get("publishedDate") or "Unknown"
        text = "\n".join(
            [
                title,
                url,
                published,
                result.get("content", "") or result.get("snippet", "") or result.get("raw_content", ""),
            ]
        )
        add_doc(
            text,
            "source",
            title,
            {
                "url": url,
                "domain": urlparse(url).netloc,
                "published": published,
            },
        )

    return documents


def _normalize_vector(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector
    return [value / magnitude for value in vector]


def _lexical_tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z0-9]{3,}", text.lower()))


def build_retrieval_index(documents: list[dict[str, Any]]) -> dict[str, Any]:
    model = _get_embedding_model()
    if model is None:
        return {
            "strategy": "lexical",
            "documents": [
                {**document, "tokens": sorted(_lexical_tokens(document["text"]))}
                for document in documents
            ],
        }

    vectors = model.encode([document["text"] for document in documents], normalize_embeddings=True)
    return {
        "strategy": "embedding",
        "model": EMBEDDING_MODEL_NAME,
        "documents": documents,
        "vectors": [list(vector) for vector in vectors],
    }


def retrieve_context(index: dict[str, Any], query: str, top_k: int = 6) -> list[dict[str, Any]]:
    if index.get("strategy") == "embedding":
        model = _get_embedding_model()
        if model is None:
            return []
        query_vector = _normalize_vector(list(model.encode([query])[0]))
        scored = []
        for document, vector in zip(index["documents"], index["vectors"]):
            score = sum(left * right for left, right in zip(query_vector, vector))
            scored.append((score, document))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [{**document, "score": float(score)} for score, document in scored[:top_k]]

    query_tokens = _lexical_tokens(query)
    scored = []
    for document in index.get("documents", []):
        document_tokens = set(document.get("tokens", []))
        overlap = len(query_tokens & document_tokens)
        scored.append((overlap, {key: value for key, value in document.items() if key != "tokens"}))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [{**document, "score": float(score)} for score, document in scored[:top_k] if score > 0]


def build_source_summary(sources: list[dict[str, Any]]) -> dict[str, Any]:
    filing_domains = {"sec.gov", "annualreports.com", "nseindia.com", "bseindia.com", "sebi.gov.in"}
    def is_filing(source: dict[str, Any]) -> bool:
        host = (urlparse(source.get("url", "")).hostname or source.get("domain", "")).lower().rstrip(".")
        return any(host == domain or host.endswith("." + domain) for domain in filing_domains)

    filings = [source for source in sources if is_filing(source)]
    return {
        "sourceCount": len(sources),
        "filingSourceCount": len(filings),
        "hasFilings": len(filings) > 0,
    }


def build_coverage_status(financial_data: dict[str, Any], source_summary: dict[str, Any]) -> dict[str, Any]:
    symbol_info = financial_data.get("symbol_info", {})
    filing_status = "available" if source_summary["hasFilings"] else "partial"
    return {
        "market": symbol_info.get("market", "unknown"),
        "resolvedSymbol": symbol_info.get("resolved_symbol", symbol_info.get("input_ticker", "")),
        "filings": filing_status,
        "workspaceMode": "temporary",
        "financialData": "available" if symbol_info.get("resolution_status") == "confirmed" else "unavailable",
    }
