"""
JSON cleaning and output normalization utilities.

Mirrors the three 'Code in JavaScript' nodes from the n8n workflow that
strip markdown fences and remap LLM output keys to fixed frontend keys.
"""

import json
import re


def clean_llm_json(raw: str) -> dict:
    """
    Strip markdown code fences and parse JSON from raw LLM output.

    Mirrors the common pattern in all three n8n JS code nodes:
        raw.replace(/```json/g, '').replace(/```/g, '').trim()
    """
    cleaned = raw.strip()
    cleaned = re.sub(r"```json\s*", "", cleaned)
    cleaned = re.sub(r"```\s*", "", cleaned)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Try to extract JSON from the text (find first { to last })
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")
        if first_brace != -1 and last_brace != -1:
            try:
                return json.loads(cleaned[first_brace : last_brace + 1])
            except json.JSONDecodeError:
                pass
        return {"error": True, "error_message": f"JSON parse failed: {str(e)}"}


def _get(obj: dict, *keys):
    """Return the first non-None value for any of the given keys."""
    for key in keys:
        if obj.get(key) is not None:
            return obj[key]
    return None


def normalize_ib_output(parsed: dict) -> dict:
    """
    Normalize Investment Banker analyst output to fixed frontend keys.

    Mirrors 'Code in JavaScript1' from the n8n workflow.
    """
    safe = {
        "data_quality": _get(parsed, "data_quality"),
        "quality_of_earnings": _get(parsed, "quality_of_earnings"),
        "capital_structure": _get(parsed, "capital_structure"),
        "returns_analysis": _get(parsed, "returns_analysis"),
        "variant_perception": _get(parsed, "variant_perception"),
        "peer_benchmarking": _get(parsed, "peer_benchmarking"),
        "stress_test": _get(parsed, "stress_test"),
        "management_questions": _get(parsed, "management_questions"),
        "ic_briefing": _get(parsed, "ic_briefing"),
    }

    nulls = [k for k, v in safe.items() if v is None]
    if nulls:
        print(f"[IB PARSER] Null keys: {nulls}")

    return safe


def normalize_mc_output(parsed: dict) -> dict:
    """
    Normalize Management Consulting analyst output to fixed frontend keys.

    Mirrors 'Code in JavaScript2' from the n8n workflow, including the
    fallback key aliases (e.g. 'framework_1_problem_definition').
    """
    safe = {
        "company": _get(parsed, "company"),
        "ticker": _get(parsed, "ticker"),
        "sector": _get(parsed, "sector"),
        "period": _get(parsed, "period"),
        "generated_on": _get(parsed, "generated_on"),
        "data_quality": _get(parsed, "data_quality"),
        "problem_definition": _get(
            parsed, "problem_definition", "framework_1_problem_definition"
        ),
        "industry_structure": _get(
            parsed, "industry_structure", "framework_2_industry_structure"
        ),
        "competitive_position": _get(
            parsed, "competitive_position", "framework_3_competitive_position"
        ),
        "value_chain": _get(
            parsed, "value_chain", "framework_4_value_chain"
        ),
        "full_potential_gap": _get(
            parsed, "full_potential_gap", "framework_5_full_potential_gap"
        ),
        "growth_architecture": _get(
            parsed, "growth_architecture", "framework_6_growth_architecture"
        ),
        "strategic_options": _get(
            parsed, "strategic_options", "framework_7_strategic_options"
        ),
        "organizational_readiness": _get(
            parsed,
            "organizational_readiness",
            "framework_8_organizational_readiness",
        ),
        "board_recommendation": _get(
            parsed, "board_recommendation", "board_recommendation_scr"
        ),
    }

    nulls = [k for k, v in safe.items() if v is None]
    if nulls:
        print(f"[MC PARSER] Null keys: {nulls}")

    return safe
