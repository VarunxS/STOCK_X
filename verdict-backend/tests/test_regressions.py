import io
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from docx import Document

import main
from graph import merge_node
from data import financial
from services.retrieval import build_source_summary
from services.workspace_store import create_workspace
from utils.openrouter import invoke_with_model_fallback


class CoverageTests(unittest.TestCase):
    def test_filing_hosts_include_subdomains_but_reject_lookalikes(self):
        sources = [{"url": url} for url in [
            "https://www.sec.gov/Archives/filing.htm",
            "https://www.annualreports.com/report.pdf",
            "https://www.nseindia.com/report",
            "https://bseindia.com/report",
            "https://sec.gov.example.com/report",
            "https://reuters.com/article",
        ]]
        summary = build_source_summary(sources)
        self.assertEqual(summary["sourceCount"], 6)
        self.assertEqual(summary["filingSourceCount"], 4)
        self.assertTrue(summary["hasFilings"])

    def test_financial_errors_do_not_expose_credentials(self):
        request = httpx.Request("GET", "https://example.com/data?symbol=NVDA&apikey=test-secret")
        response = httpx.Response(401, request=request)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            serialized = financial._serialize_error(error)
        self.assertNotIn("test-secret", str(serialized))
        self.assertEqual(serialized["status_code"], 401)


class FinancialTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_failed_symbols_preserve_input_and_unconfirmed_market(self):
        async def failed_bundle(client, symbol, key):
            return {"symbol": symbol, **{field: {"error": True, "message": "no data"} for field in ["balance_sheet", "income_statement", "cash_flow", "financial_ratios"]}}
        with patch.object(financial, "_fetch_symbol_bundle", side_effect=failed_bundle):
            result = await financial.fetch_all_financial_data("nvda", "test-key")
        self.assertEqual(result["symbol_info"]["resolved_symbol"], "NVDA")
        self.assertEqual(result["symbol_info"]["market"], "unknown")
        self.assertEqual(result["symbol_info"]["resolution_status"], "unconfirmed")

    async def test_successful_indian_symbol_is_confirmed(self):
        async def bundle(client, symbol, key):
            return {"symbol": symbol, "balance_sheet": [{"revenue": 1}] if symbol.endswith(".NS") else [], "income_statement": [], "cash_flow": [], "financial_ratios": []}
        with patch.object(financial, "_fetch_symbol_bundle", side_effect=bundle):
            result = await financial.fetch_all_financial_data("RELIANCE", "test-key")
        self.assertEqual(result["symbol_info"]["market"], "india")
        self.assertEqual(result["symbol_info"]["resolved_symbol"], "RELIANCE.NS")

    async def test_memo_is_not_generated_without_research_or_financial_evidence(self):
        with self.assertRaisesRegex(ValueError, "Research data is unavailable"):
            await merge_node({"financial_data": {"balance_sheet": {"error": True}}, "market_intel": []})
        merged = await merge_node({"financial_data": {}, "market_intel": [{"content": "Retrieved filing"}]})
        self.assertEqual(len(merged["merged_data"]["market_intelligence"]), 1)

    async def test_missing_key_does_not_send_unauthenticated_financial_requests(self):
        with patch.object(financial, "_fetch_symbol_bundle", new_callable=AsyncMock) as fetch:
            result = await financial.fetch_all_financial_data("NVDA", None)
        fetch.assert_not_called()
        self.assertTrue(result["balance_sheet"]["error"])


class InferenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_output_budget_is_sent_to_provider(self):
        response = MagicMock(response_metadata={"finish_reason": "stop"})
        llm = MagicMock(ainvoke=AsyncMock(return_value=response))
        with patch.dict(os.environ, {"INFERENCE_MAX_TOKENS": "4096"}), patch("utils.openrouter.ChatOpenAI", return_value=llm) as factory:
            await invoke_with_model_fallback(messages=[], api_key="test", preferred_model="openai/gpt-4o-mini")
        self.assertEqual(factory.call_args.kwargs["max_tokens"], 4096)
        self.assertEqual(factory.call_args.kwargs["openai_api_base"], "https://openrouter.ai/api/v1")

    async def test_truncated_response_is_not_treated_as_success(self):
        llm = MagicMock(ainvoke=AsyncMock(return_value=MagicMock(response_metadata={"finish_reason": "length"})))
        with patch("utils.openrouter.ChatOpenAI", return_value=llm):
            with self.assertRaisesRegex(ValueError, "output limit"):
                await invoke_with_model_fallback(messages=[], api_key="test", preferred_model="openai/gpt-4o-mini")


class WorkspaceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.workspace = create_workspace({"ticker": "NVDA", "memo": {"title": "Test memo"}, "coverage_status": {}, "retrieval_index": {"strategy": "lexical", "documents": []}, "qa_history": [{"question": "Cleared regression question", "answer": "Old answer"}]})
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_clear_history_removes_interactions_from_export(self):
        body = {"workspace_id": self.workspace["workspace_id"]}
        before = await self.client.post("/workspace/export", json=body)
        self.assertIn("Cleared regression question", self.document_text(before.json()))
        cleared = await self.client.post("/workspace/clear-history", json=body)
        self.assertEqual(cleared.status_code, 200)
        self.assertEqual(cleared.json()["qaHistory"], [])
        after = await self.client.post("/workspace/export", json=body)
        self.assertNotIn("Cleared regression question", self.document_text(after.json()))

    async def test_refresh_returns_browser_contract_and_requires_inference(self):
        body = {"workspace_id": self.workspace["workspace_id"], "api_keys": {"openrouter": "test"}, "model_name": "openai/gpt-4o-mini"}
        with patch.object(main, "generate_suggested_questions", new_callable=AsyncMock, return_value=["New question"]):
            response = await self.client.post("/workspace/suggest-questions", json=body)
        self.assertEqual(response.json()["suggestedQuestions"], ["New question"])
        invalid = await self.client.post("/workspace/suggest-questions", json={"workspace_id": self.workspace["workspace_id"]})
        self.assertEqual(invalid.status_code, 400)

    async def test_clearing_expired_workspace_returns_404(self):
        response = await self.client.post("/workspace/clear-history", json={"workspace_id": "missing"})
        self.assertEqual(response.status_code, 404)

    @staticmethod
    def document_text(payload):
        document = Document(io.BytesIO(bytes.fromhex(payload["content"])))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)


if __name__ == "__main__":
    unittest.main()
