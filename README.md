# STOCK X

STOCK X is a modern stock market investment intelligence platform designed for both retail and institutional investors.

STOCK X delivers:
- One concise, grounded decision memo for any listed public company (US + India)
- A grounded vector/lexical retrieval workspace indexing filings, financial reports, and market intelligence
- The **DataPulse Agent**: an interactive stock intelligence agent that auto-suggests high-priority investment questions and answers any ad-hoc stock query with valuation multiples, earnings catalysts, and citation-backed evidence
- Executive `.docx` export containing both the full decision memo and all DataPulse interrogations

## Product Flow

1. Enter a listed-company ticker (e.g. `TITAN`, `RELIANCE`, `NVDA`, `HDFC`).
2. Generate the synthesized investment decision memo.
3. Explore auto-suggested stock questions or ask any custom question in the DataPulse Agent.
4. Drill deeper into valuation multiples, earnings momentum, margin sustainability, and risk-reward skew.
5. Export the memo and complete DataPulse thread as an editable `.docx`.

## Stack

- Frontend: Next.js 14, Tailwind CSS, Lucide icons
- Backend: FastAPI, Python 3.11
- RAG & Embeddings: sentence-transformers (`all-MiniLM-L6-v2`) with automatic lexical fallback
- Inference: BYOK (Bring Your Own Key) supporting OpenRouter, OpenAI, and Gemini
- Session: ephemeral, browser-cached workspace store

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- `npm`
- `pip`

### Frontend

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` (or `http://localhost:3001` if 3000 is occupied).

### Backend

```bash
cd verdict-backend
python3 -m venv --system-site-packages .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py --host 0.0.0.0 --port 8000
```

The backend runs on `http://localhost:8000`.

### Required Environment

Backend:
- `TAVILY_API_KEY` (in `.env` or environment) for research search
- `FMP_API_KEY` for financial statements and ratios; without it, coverage is shown as unavailable
- `INFERENCE_MAX_TOKENS` (optional, defaults to `8192`) limits output tokens per inference call

Frontend:
- `VERDICT_BACKEND_URL` or `STOCKX_BACKEND_URL` (defaults to `http://localhost:8000`)

Inference keys (OpenRouter / OpenAI / Gemini) are entered via the Inference modal in the UI and stored in browser `localStorage` and `sessionStorage`. Clear Key removes both copies. OpenRouter defaults to GPT-4o Mini for affordable analysis.

## Repo Structure

```text
app/
  page.tsx                 STOCK X landing page
  analyze/page.tsx         compatibility redirect into workspace
  workspace/[ticker]/      investment workspace with Memo & DataPulse Agent
  api/analyze/route.ts     frontend -> backend analyze proxy
  api/qa/route.ts          frontend -> backend DataPulse proxy
  api/export/route.ts      frontend -> backend export proxy

components/
  layout/ApiKeyModal.tsx   provider, key, and model selection

lib/
  data-store.ts            browser session state
  inference-catalog.ts     provider and model dropdown options
  workspace.ts             workspace types & DataPulse Q&A models

verdict-backend/
  main.py                  FastAPI entrypoint (STOCK X Analysis API)
  graph.py                 orchestration state graph
  agents/                  qa_agent (DataPulse Agent), unified_memo, query_intelligence, audit, IB, MC
  services/                retrieval (RAG vector/lexical), export_docx, workspace_store
  tools/                   search integration
  data/                    financial data pulling
```

## Validation

Frontend:

```bash
npm run lint
npm run build
```

Backend (from `verdict-backend`):

```bash
python -m unittest discover -s tests -v
```

Copy `verdict-backend/.env.example` to `verdict-backend/.env` and configure the research services. Fresh analysis requires retrieved research sources or financial data. If both are unavailable, analysis reports a setup error. A listing market is shown as unconfirmed until financial symbol resolution succeeds.

On Windows, start the backend with PowerShell:

```powershell
cd verdict-backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe main.py --host 127.0.0.1 --port 8000
```
