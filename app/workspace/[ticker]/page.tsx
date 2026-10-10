'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
    Download,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    Send,
    MessageSquare,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    HelpCircle,
    CheckCircle2,
    Trash2,
    TrendingUp,
    Activity,
    BarChart3,
    Layers,
    FileText,
    ArrowLeft,
} from 'lucide-react'

import { ApiKeyModal } from '@/components/layout/ApiKeyModal'
import {
    clearWorkspaceSession,
    getApiKey,
    getModelName,
    getProviderType,
    getWorkspaceSession,
    isInferenceConfigured,
    saveWorkspaceSession,
} from '@/lib/data-store'
import type { QAInteraction, WorkspacePayload, WorkspaceSession } from '@/lib/workspace'

const LOADING_STAGES = [
    'Connecting to market feed & regulatory indices...',
    'Ingesting balance sheet, income statement & consensus metrics...',
    'Synthesizing investment decision memo...',
    'Priming DataPulse Agent with valuation benchmarks and filing references...',
]

function Section({
    title,
    summary,
    bullets,
}: {
    title: string
    summary: string
    bullets: string[]
}) {
    return (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#3154e8]" />
                <div className="text-xs uppercase tracking-wider text-[#3154e8] font-bold">
                    {title}
                </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-700 mb-4 font-medium">{summary}</p>
            <div className="space-y-2.5">
                {bullets.map((bullet, index) => (
                    <div key={index} className="flex gap-3 text-xs sm:text-sm leading-relaxed text-slate-600">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3154e8]" />
                        <span>{bullet}</span>
                    </div>
                ))}
            </div>
        </section>
    )
}

function QAInteractionCard({
    interaction,
    onAskFollowup,
}: {
    interaction: QAInteraction
    onAskFollowup: (q: string) => void
}) {
    const [showEvidence, setShowEvidence] = useState(false)

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4 hover:border-slate-300 transition-all">
            {/* Question */}
            <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1.5 text-[#3154e8] font-semibold text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3154e8]" />
                        Investor Query
                    </span>
                    <span>{interaction.timestamp}</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {interaction.question}
                </h3>
            </div>

            {/* Answer */}
            <div className="text-xs sm:text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                {interaction.answer}
            </div>

            {/* Evidence & Sources drawer */}
            {interaction.evidence && interaction.evidence.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                    <button
                        onClick={() => setShowEvidence(!showEvidence)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors"
                    >
                        <span>{interaction.evidence.length} Filing Sources Cited</span>
                        {showEvidence ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                        )}
                    </button>

                    {showEvidence && (
                        <div className="mt-3 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                            {interaction.evidence.map((ev, i) => (
                                <div key={i} className="text-xs text-slate-600 pb-2 border-b border-slate-200/60 last:border-b-0 last:pb-0">
                                    <div className="font-semibold text-slate-900">{ev.title}</div>
                                    <div className="text-slate-500 mt-0.5">{ev.snippet}</div>
                                    {ev.url && (
                                        <a
                                            href={ev.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#3154e8] hover:underline inline-flex items-center gap-1 mt-1 text-[11px]"
                                        >
                                            <span>View Filing</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Follow-up Question Suggestions */}
            {interaction.followupSuggestions && interaction.followupSuggestions.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                        Suggested Follow-Up
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {interaction.followupSuggestions.map((fu, idx) => (
                            <button
                                key={idx}
                                onClick={() => onAskFollowup(fu)}
                                className="text-left text-xs bg-slate-50 hover:bg-[#3154e8]/10 hover:text-[#3154e8] hover:border-[#3154e8]/30 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                            >
                                {fu}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function WorkspacePage({ params }: { params: { ticker: string } }) {
    const rawTicker = params.ticker ? decodeURIComponent(params.ticker) : ''
    const ticker = rawTicker.toUpperCase().trim()

    const [loading, setLoading] = useState(true)
    const [loadingStage, setLoadingStage] = useState(0)
    const [workspace, setWorkspace] = useState<WorkspaceSession | null>(null)
    const [error, setError] = useState('')
    const [showKeyModal, setShowKeyModal] = useState(false)
    const [exporting, setExporting] = useState(false)

    // DataPulse Agent state
    const [questionInput, setQuestionInput] = useState('')
    const [qaLoading, setQaLoading] = useState(false)
    const [qaError, setQaError] = useState('')
    const [suggestingQuestions, setSuggestingQuestions] = useState(false)
    const qaBottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ticker) {
            setError('Ticker parameter is required')
            setLoading(false)
            return
        }

        const cached = getWorkspaceSession(ticker)
        if (cached) {
            setWorkspace(cached)
            setLoading(false)
            return
        }

        if (!isInferenceConfigured()) {
            setShowKeyModal(true)
            setError('Please configure your inference provider & API key to analyze this stock.')
            setLoading(false)
            return
        }

        let cancelled = false
        setLoading(true)
        setError('')
        setLoadingStage(0)

        const timer = window.setInterval(() => {
            setLoadingStage((curr) => (curr < LOADING_STAGES.length - 1 ? curr + 1 : curr))
        }, 2200)

        const run = async () => {
            try {
                const apiKey = getApiKey()
                const providerType = getProviderType()
                const modelName = getModelName()
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker, apiKey, providerType, modelName }),
                })
                const payload = await response.json()
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || 'Unable to create workspace')
                }
                if (cancelled) return

                const nextWorkspace: WorkspaceSession = {
                    ...(payload as WorkspacePayload),
                    ticker,
                    qaHistory: [],
                    suggestedQuestions: payload.suggestedQuestions || [
                        `What are the key stock market catalysts and earnings drivers for ${ticker}?`,
                        `How do current valuation multiples (P/E, EV/EBITDA) compare to sector peers?`,
                        `What is the risk-reward profile and downside risk for investors holding ${ticker}?`,
                        `How sustainable are ${ticker}'s operating margins and free cash flow generation?`,
                        `What is management's guidance on revenue growth, Capex, and shareholder returns?`,
                    ],
                }
                setWorkspace(nextWorkspace)
                saveWorkspaceSession(ticker, nextWorkspace)
            } catch (caughtError: any) {
                if (!cancelled) {
                    setError(caughtError?.message || 'Unable to create workspace')
                    clearWorkspaceSession(ticker)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
                window.clearInterval(timer)
            }
        }

        void run()

        return () => {
            cancelled = true
            window.clearInterval(timer)
        }
    }, [ticker])

    const refreshKeyStatus = () => {
        if (isInferenceConfigured() && !workspace) {
            window.location.reload()
        }
    }

    async function handleAskQuestion(queryToAsk?: string) {
        const query = (queryToAsk || questionInput).trim()
        if (!workspace || !query || qaLoading) return

        setQaLoading(true)
        setQaError('')
        setQuestionInput('')

        try {
            const response = await fetch('/api/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: workspace.workspaceId,
                    question: query,
                    chatHistory: (workspace.qaHistory || []).map((h) => ({
                        question: h.question,
                        answer: h.answer,
                    })),
                    apiKey: getApiKey(),
                    providerType: getProviderType(),
                    modelName: getModelName(),
                }),
            })

            const data = await response.json()
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to get answer from DataPulse Agent')
            }

            const newInteraction: QAInteraction = {
                id: data.interactionId || `qa-${Date.now()}`,
                question: query,
                answer: data.answer,
                evidence: data.evidence || [],
                followupSuggestions: data.followupSuggestions || [],
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }

            const nextWorkspace: WorkspaceSession = {
                ...workspace,
                qaHistory: [...(workspace.qaHistory || []), newInteraction],
            }
            setWorkspace(nextWorkspace)
            saveWorkspaceSession(ticker, nextWorkspace)

            setTimeout(() => {
                qaBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        } catch (caughtError: any) {
            setQaError(caughtError?.message || 'DataPulse query failed')
        } finally {
            setQaLoading(false)
        }
    }

    async function handleRefreshSuggestions() {
        if (!workspace || suggestingQuestions) return
        setSuggestingQuestions(true)
        try {
            const response = await fetch('/api/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: workspace.workspaceId,
                    suggestOnly: true,
                    apiKey: getApiKey(),
                    providerType: getProviderType(),
                    modelName: getModelName(),
                }),
            })
            const data = await response.json()
            if (data.success && data.suggestedQuestions) {
                const nextWorkspace: WorkspaceSession = {
                    ...workspace,
                    suggestedQuestions: data.suggestedQuestions,
                }
                setWorkspace(nextWorkspace)
                saveWorkspaceSession(ticker, nextWorkspace)
            }
        } catch {
            // keep existing
        } finally {
            setSuggestingQuestions(false)
        }
    }

    function clearHistory() {
        if (!workspace) return
        const nextWorkspace: WorkspaceSession = {
            ...workspace,
            qaHistory: [],
        }
        setWorkspace(nextWorkspace)
        saveWorkspaceSession(ticker, nextWorkspace)
    }

    async function exportWorkspace() {
        if (!workspace) return
        setExporting(true)
        try {
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: workspace.workspaceId }),
            })
            if (!response.ok) {
                const payload = await response.json()
                throw new Error(payload.error || 'Export failed')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `stockx-${ticker.toLowerCase()}-research-report.docx`
            link.click()
            window.URL.revokeObjectURL(url)
        } catch (caughtError: any) {
            setQaError(caughtError?.message || 'Export failed')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#f8f9fb] text-slate-900 font-sans">
            {/* Top Navigation */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2 text-xl font-black text-slate-900 no-underline hover:opacity-80 transition-opacity">
                            <span>STOCK</span>
                            <span className="text-[#3154e8]">X</span>
                        </Link>
                        <div className="h-4 w-px bg-slate-200" />
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#3154e8]/10 text-[#3154e8] font-bold">
                                ${ticker}
                            </span>
                            <span className="hidden sm:inline text-slate-400">· Equity Research</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => setShowKeyModal(true)}
                            className="border border-slate-200 hover:border-slate-300 px-4 h-9 text-xs font-medium text-slate-700 hover:text-slate-900 rounded-full bg-white shadow-sm transition-all cursor-pointer"
                        >
                            Inference
                        </button>
                        <button
                            onClick={exportWorkspace}
                            disabled={!workspace || exporting}
                            className="bg-[#3154e8] hover:bg-[#2545d8] text-white font-semibold px-5 h-9 text-xs rounded-full shadow-sm hover:shadow disabled:opacity-40 inline-flex items-center gap-2 transition-all cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>{exporting ? 'Exporting...' : 'Export DOCX'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Loading State */}
                {loading && (
                    <section className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-sm max-w-2xl mx-auto my-8 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#3154e8]/10 text-[#3154e8] flex items-center justify-center mx-auto mb-5">
                            <RefreshCw className="w-6 h-6 animate-spin" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-slate-900">${ticker} Equity Synthesis</h1>
                        <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                            Ingesting market filings, calculating valuation multiples, and priming the DataPulse Agent.
                        </p>
                        <div className="space-y-3 text-left max-w-md mx-auto">
                            {LOADING_STAGES.map((stage, index) => (
                                <div key={stage} className="flex items-center gap-3 text-xs text-slate-600">
                                    <span className={`h-2 w-2 rounded-full shrink-0 ${index <= loadingStage ? 'bg-[#3154e8]' : 'bg-slate-300'}`} />
                                    <span className={index <= loadingStage ? 'text-slate-900 font-semibold' : 'text-slate-400'}>{stage}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Error State */}
                {!loading && error && !workspace && (
                    <section className="bg-white border border-red-200 rounded-3xl p-8 sm:p-10 shadow-sm max-w-xl mx-auto my-8 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Research Workspace Unavailable</h2>
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">{error}</p>
                        <button
                            onClick={() => setShowKeyModal(true)}
                            className="bg-[#3154e8] hover:bg-[#2545d8] text-white font-semibold px-6 py-2.5 text-xs rounded-full shadow-sm transition-all cursor-pointer"
                        >
                            Configure Inference
                        </button>
                    </section>
                )}

                {/* Workspace Loaded */}
                {workspace && (
                    <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-8 items-start">
                        {/* Left Column: Decision Memo */}
                        <div className="space-y-6">
                            {/* Stock Snapshot Hero Card */}
                            <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
                                                {workspace.coverageStatus.market.toUpperCase()}
                                            </span>
                                            <span className="text-xs font-bold text-[#3154e8]">
                                                ${ticker}
                                            </span>
                                        </div>
                                        <h1 className="text-2xl font-bold mb-2 text-slate-900">{workspace.memo.title}</h1>
                                        <p className="text-sm leading-relaxed text-slate-600">
                                            {workspace.memo.company_snapshot.summary}
                                        </p>
                                    </div>
                                    <div className="text-right text-xs text-slate-400 space-y-1">
                                        <div className="font-semibold text-slate-600">
                                            Filings: {workspace.coverageStatus.filings}
                                        </div>
                                        <div>Sources: {workspace.sourceSummary.sourceCount} indexed</div>
                                    </div>
                                </div>

                                {/* Highlights 4-Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                                    {workspace.memo.company_snapshot.highlights.map((item, index) => (
                                        <div key={index} className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl text-xs text-slate-700 leading-snug">
                                            <span className="text-[#3154e8] font-bold block mb-1">0{index + 1}</span>
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <Section title="Core Investment Thesis" {...workspace.memo.core_thesis} />
                            <Section title="Market Share & Competitive Position" {...workspace.memo.market_and_competitive_position} />
                            <Section title="Financial Quality & Balance Sheet Constraints" {...workspace.memo.financial_quality_and_constraints} />
                            <Section title="Key Risks & Downside Triggers" {...workspace.memo.key_risks_and_stress_points} />
                            <Section title="Recommended Strategic Moves" {...workspace.memo.recommended_next_moves} />

                            {/* Evidence and Disclosures */}
                            <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-sm">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                                    <div className="text-xs uppercase tracking-wider text-[#3154e8] font-bold flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-[#3154e8]" />
                                        <span>Evidence & Filing Disclosures ({workspace.sources.length})</span>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        100% Verified
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {workspace.memo.evidence_and_sources.map((source, index) => (
                                        <div key={index} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                                            <div className="text-xs sm:text-sm font-semibold text-slate-900">{source.title}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{source.relevance}</div>
                                            {source.url && (
                                                <a
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-[#3154e8] hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                                                >
                                                    <span>View Filing</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: DataPulse Agent */}
                        <aside className="space-y-6 xl:sticky xl:top-24">
                            {/* Main DataPulse Agent Control Card */}
                            <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-[#3154e8]/10 text-[#3154e8] flex items-center justify-center">
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-slate-900">
                                                DataPulse Agent
                                            </h2>
                                            <span className="text-[11px] text-slate-500 font-medium block">
                                                Equity Intelligence Copilot
                                            </span>
                                        </div>
                                    </div>
                                    <div className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                                        ${ticker} Grounded
                                    </div>
                                </div>

                                <p className="text-xs sm:text-sm leading-relaxed text-slate-600 mb-5">
                                    Interrogate <strong>${ticker}</strong> for valuation multiples, earnings surprises, competitive moats, and filings. Grounded strictly in regulatory filings for retail & institutional investors.
                                </p>

                                {/* Suggested Questions */}
                                <div className="mb-5 bg-slate-50 border border-slate-200/70 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                            <HelpCircle className="w-3.5 h-3.5 text-[#3154e8]" />
                                            <span>Suggested Investment Questions</span>
                                        </div>
                                        <button
                                            onClick={handleRefreshSuggestions}
                                            disabled={suggestingQuestions}
                                            className="text-xs text-slate-500 hover:text-[#3154e8] inline-flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer font-medium"
                                            title="Regenerate question ideas"
                                        >
                                            <RefreshCw className={`w-3 h-3 ${suggestingQuestions ? 'animate-spin text-[#3154e8]' : ''}`} />
                                            <span>Refresh</span>
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {(workspace.suggestedQuestions || []).map((q, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => void handleAskQuestion(q)}
                                                disabled={qaLoading}
                                                className="w-full text-left text-xs bg-white hover:bg-[#3154e8]/5 hover:border-[#3154e8]/40 text-slate-700 hover:text-[#3154e8] p-2.5 border border-slate-200 rounded-lg transition-all flex items-start gap-2 group leading-snug cursor-pointer shadow-2xs"
                                            >
                                                <span className="text-[#3154e8] font-bold text-[11px] mt-0.5">
                                                    0{idx + 1}
                                                </span>
                                                <span className="flex-1 font-medium">{q}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Question Input Box */}
                                <div className="space-y-3">
                                    <div className="relative">
                                        <textarea
                                            value={questionInput}
                                            onChange={(e) => setQuestionInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault()
                                                    void handleAskQuestion()
                                                }
                                            }}
                                            rows={3}
                                            disabled={qaLoading}
                                            className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:border-[#3154e8] focus:ring-2 focus:ring-[#3154e8]/10 transition-all placeholder:text-slate-400 rounded-xl resize-none"
                                            placeholder={`Ask anything about ${ticker} (e.g. valuation multiples vs peers, upcoming earnings catalysts, dividend safety, margin outlook)...`}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs text-slate-400">
                                            Press <kbd className="border border-slate-200 px-1.5 py-0.5 rounded bg-white text-slate-600 font-mono text-[11px]">Enter ↵</kbd> to ask
                                        </div>
                                        <button
                                            onClick={() => void handleAskQuestion()}
                                            disabled={qaLoading || !questionInput.trim()}
                                            className="bg-[#3154e8] hover:bg-[#2545d8] text-white font-semibold px-5 h-9 text-xs rounded-full shadow-sm hover:shadow disabled:opacity-40 inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                                        >
                                            {qaLoading ? (
                                                <>
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Analyzing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-3.5 h-3.5" />
                                                    <span>Ask DataPulse</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {qaError && (
                                    <div className="mt-3 bg-red-50 border border-red-200 p-3 text-xs leading-relaxed text-red-700 rounded-xl">
                                        {qaError}
                                    </div>
                                )}
                            </section>

                            {/* DataPulse Conversation History Stream */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                        <MessageSquare className="w-4 h-4 text-[#3154e8]" />
                                        <span>DataPulse Inquiries ({(workspace.qaHistory || []).length})</span>
                                    </div>
                                    {(workspace.qaHistory || []).length > 0 && (
                                        <button
                                            onClick={clearHistory}
                                            className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Clear</span>
                                        </button>
                                    )}
                                </div>

                                {(workspace.qaHistory || []).length === 0 ? (
                                    <div className="bg-white border border-slate-200/80 rounded-2xl p-7 text-center shadow-sm">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                            <Activity className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-900 mb-1">
                                            Ready to Interrogate ${ticker}
                                        </h4>
                                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                                            Select any suggested stock question above or type your query in the prompt box to analyze valuation, earnings, and risk factors.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {workspace.qaHistory.map((item) => (
                                            <QAInteractionCard
                                                key={item.id}
                                                interaction={item}
                                                onAskFollowup={(q) => void handleAskQuestion(q)}
                                            />
                                        ))}
                                        <div ref={qaBottomRef} />
                                    </div>
                                )}
                            </section>
                        </aside>
                    </div>
                )}
            </main>

            <ApiKeyModal
                isOpen={showKeyModal}
                onClose={() => setShowKeyModal(false)}
                onSave={refreshKeyStatus}
            />
        </div>
    )
}
