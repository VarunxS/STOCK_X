from __future__ import annotations

import os
from typing import Iterable, Optional

from langchain_openai import ChatOpenAI

SUPPORTED_PROVIDERS = {"openrouter", "openai", "gemini"}


def resolve_provider_type(provider_type: Optional[str] = None) -> str:
    value = (provider_type or "openrouter").strip().lower()
    if value not in SUPPORTED_PROVIDERS:
        raise ValueError(f"Unsupported inference provider: {value}")
    return value


def resolve_model_name(provider_type: str, preferred_model: Optional[str] = None) -> str:
    env_name = {
        "openrouter": "OPENROUTER_MODEL",
        "openai": "OPENAI_MODEL",
        "gemini": "GEMINI_MODEL",
    }.get(provider_type, "OPENROUTER_MODEL")
    value = (preferred_model or os.environ.get(env_name, "")).strip()
    if not value:
        raise ValueError("Inference model is required.")
    return value


def parse_provider_order(provider_order: Optional[Iterable[str]]) -> list[str]:
    providers: list[str] = []
    for value in provider_order or []:
        cleaned = str(value).strip()
        if cleaned and cleaned not in providers:
            providers.append(cleaned)
    return providers


async def invoke_with_model_fallback(
    *,
    messages: Iterable,
    api_key: str,
    preferred_model: Optional[str] = None,
    provider_type: Optional[str] = None,
    provider_order: Optional[Iterable[str]] = None,
    strict_provider: bool = False,
    temperature: float = 0.2,
):
    resolved_provider = resolve_provider_type(provider_type)
    if not api_key:
        raise ValueError(f"{resolved_provider.title()} API key is required.")
    model_name = resolve_model_name(resolved_provider, preferred_model)
    providers = parse_provider_order(provider_order)

    llm_kwargs = {
        "model": model_name,
        "temperature": temperature,
        "openai_api_key": api_key,
    }

    if resolved_provider == "openrouter":
        llm_kwargs["openai_api_base"] = "https://openrouter.ai/api/v1"
    elif resolved_provider == "gemini":
        llm_kwargs["openai_api_base"] = "https://generativelanguage.googleapis.com/v1beta/openai/"

    model_kwargs = {}
    if resolved_provider == "openrouter" and providers:
        provider_payload = {"only": providers} if strict_provider else {"order": providers}
        model_kwargs["provider"] = provider_payload

    if model_kwargs:
        llm_kwargs["model_kwargs"] = model_kwargs

    llm = ChatOpenAI(**llm_kwargs)
    return await llm.ainvoke(list(messages))
