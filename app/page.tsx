'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Key,
} from 'lucide-react'
import { ApiKeyModal } from '@/components/layout/ApiKeyModal'
import { isInferenceConfigured } from '@/lib/data-store'

export default function Home() {
  const [query, setQuery] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(false)
  const [pendingTicker, setPendingTicker] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setKeyConfigured(isInferenceConfigured())
  }, [])

  const refreshKeyStatus = () => {
    const isReady = isInferenceConfigured()
    setKeyConfigured(isReady)
    if (isReady && pendingTicker) {
      const tickerToOpen = pendingTicker
      setPendingTicker(null)
      router.push(`/workspace/${encodeURIComponent(tickerToOpen)}`)
    }
  }

  const navigateToTicker = (ticker: string) => {
    const clean = ticker.trim().toUpperCase()
    if (!clean) return

    if (!isInferenceConfigured()) {
      setPendingTicker(clean)
      setShowKeyModal(true)
      return
    }

    router.push(`/workspace/${encodeURIComponent(clean)}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const target = query.trim() || 'NVDA'
    navigateToTicker(target)
  }

  const focusSearch = () => {
    const el = document.getElementById('search-section')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 300)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-[#3154e8]/15 selection:text-[#3154e8]">

      {/* ═══ NAVBAR (Paymenty style) ═══ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 no-underline">
            <span>STOCK</span>
            <span className="text-[#3154e8]">X</span>
          </a>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-9 text-sm font-medium text-slate-600">
            <a href="#" className="relative cursor-pointer text-slate-900 font-semibold no-underline">
              <span>Home</span>
              <div className="w-3.5 h-0.5 bg-slate-900 rounded-full mx-auto mt-1" />
            </a>
            <a href="#features" className="hover:text-slate-900 transition-colors no-underline">
              Features
            </a>
            <a href="#datapulse" className="hover:text-slate-900 transition-colors no-underline">
              DataPulse Agent
            </a>
            <a href="#coverage" className="hover:text-slate-900 transition-colors no-underline">
              Coverage
            </a>
            <a href="#methodology" className="hover:text-slate-900 transition-colors no-underline">
              Methodology
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={focusSearch}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Search stocks"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setPendingTicker(null)
                setShowKeyModal(true)
              }}
              className="bg-[#3154e8] hover:bg-[#2545d8] text-white px-6 py-2.5 rounded-full font-medium text-sm transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-2"
            >
              {keyConfigured ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Configured</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>Set API Key</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative pt-16 pb-14 px-6 text-center max-w-5xl mx-auto">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] max-w-full h-[350px] bg-gradient-to-b from-[#3154e8]/5 via-teal-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        {/* Top Tag Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200/70 text-xs text-slate-700 font-medium mb-8 shadow-sm">
          <span className="text-sm">🌐</span>
          <span>Institutional Research, Global Scale</span>
        </div>

        {/* Big Bold Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-slate-900 leading-[1.08] mb-6">
          The Backbone Of Modern<br />
          Stock Research
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto mb-9 leading-relaxed font-normal">
          Powering retail and institutional investors with grounded decision memos, valuation multiples, and the interactive DataPulse Agent for high-conviction market decisions.
        </p>

        {/* Two Pill CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-12">
          <button
            onClick={() => navigateToTicker(query.trim() || 'NVDA')}
            className="bg-[#3154e8] hover:bg-[#2545d8] text-white px-8 py-3.5 rounded-full font-semibold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span>Start Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#features"
            className="bg-slate-100 hover:bg-slate-200/80 text-slate-800 px-8 py-3.5 rounded-full font-semibold text-sm transition-all cursor-pointer no-underline"
          >
            Learn More
          </a>
        </div>

        {/* Search Bar Container */}
        <div id="search-section" className="max-w-2xl mx-auto scroll-mt-28">
          <form onSubmit={handleSearch}>
            <div className="bg-white border border-slate-200 rounded-full p-2 pl-5 shadow-[0_6px_25px_rgba(0,0,0,0.06)] hover:border-slate-300 focus-within:border-[#3154e8] focus-within:ring-4 focus-within:ring-[#3154e8]/10 transition-all flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                className="min-w-0 flex-1 bg-transparent border-0 outline-none text-slate-900 placeholder:text-slate-400 text-sm tracking-wide py-1.5"
                placeholder="Search any US or Indian ticker (e.g. NVDA, HDFC, RELIANCE, AAPL)..."
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
              />
              <button
                type="submit"
                className="bg-[#3154e8] hover:bg-[#2545d8] text-white px-7 py-3 rounded-full font-semibold text-sm tracking-wide transition-all shadow-sm hover:shadow cursor-pointer shrink-0"
              >
                Analyze
              </button>
            </div>
          </form>

          {/* Trending Pills */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-slate-400 text-xs font-medium mr-1">Trending:</span>
            {['HDFC', 'RELIANCE', 'NVDA', 'TITAN', 'AAPL', 'TSLA'].map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => navigateToTicker(sym)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-[#3154e8]/10 hover:text-[#3154e8] text-slate-700 rounded-full text-xs font-medium transition-all cursor-pointer border border-transparent hover:border-[#3154e8]/20"
              >
                ${sym}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURE CARDS (Paymenty visual layout with 3D stock images) ═══ */}
      <section id="features" className="py-12 px-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Tall Card (All-in-One Equity Decision Memo) */}
          <div className="lg:col-span-5 bg-[#f4f5f8] rounded-3xl p-8 sm:p-10 flex flex-col justify-between border border-slate-200/60 shadow-sm overflow-hidden">
            <div>
              {/* Real 3D Stock Market Asset Image */}
              <div className="relative w-full h-56 rounded-2xl overflow-hidden mb-7 border border-slate-200/80 shadow-sm bg-white">
                <Image
                  src="/images/stock_analytics.jpg"
                  alt="Stock Market Analytics Visual"
                  fill
                  className="object-cover object-center transform hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 40vw"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-[#3154e8] shadow-sm">
                  Live Multiples
                </div>
              </div>

              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">
                All-in-One Decision Memo
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 font-normal">
                Fuses capital markets rigor with strategic diagnostics into one structured decision memo. Evaluates earnings quality, competitive position, and balance sheet constraints.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigateToTicker('NVDA')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-slate-300 hover:border-slate-400 bg-white text-slate-800 hover:text-[#3154e8] text-xs font-semibold shadow-sm transition-all cursor-pointer self-start"
            >
              <span>Run Sample Memo ($NVDA)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* Smart DataPulse Agent (Wide top card with 3D Copilot visual) */}
            <div id="datapulse" className="bg-[#f4f5f8] rounded-3xl p-8 sm:p-10 border border-slate-200/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden">
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3154e8]/10 text-[#3154e8] text-xs font-semibold mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Interactive Stock Copilot</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">
                  Smart DataPulse Agent
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6 font-normal">
                  Organize your equity diligence and surface crucial investment questions in an interactive environment that’s always ready for your next question.
                </p>
                <button
                  type="button"
                  onClick={() => navigateToTicker('AAPL')}
                  className="px-6 py-2.5 rounded-full border border-slate-300 hover:border-slate-400 bg-white text-slate-800 hover:text-[#3154e8] text-xs font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Explore Inquiries ($AAPL)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* DataPulse Visual Card with 3D Image */}
              <div className="w-full md:w-64 h-56 relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm shrink-0 bg-white">
                <Image
                  src="/images/stock_copilot.jpg"
                  alt="Stock Intelligence Terminal"
                  fill
                  className="object-cover object-center transform hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 30vw"
                />
                <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md p-2 rounded-xl text-[10px] text-slate-700 shadow-sm border border-slate-100 font-medium">
                  &quot;P/E Benchmark vs Sector&quot;
                </div>
              </div>
            </div>

            {/* Bottom Row Stats (Global Banking Partners style) */}
            <div id="coverage" className="bg-[#f4f5f8] rounded-3xl p-8 border border-slate-200/60 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
                  +7 Models
                </div>
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Valuation Frameworks
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Multiples analysis, DCF sanity checks, capital allocation, and stress testing across global markets.
                </p>
              </div>

              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
                  100% Grounded
                </div>
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  SEC & BSE Filings
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Real-time verifiable data directly cross-referenced from SEC EDGAR (US) and BSE/NSE (India) quarterly reports.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══ METHODOLOGY & ANALYTICAL MATRIX ═══ */}
      <section id="methodology" className="py-20 px-6 bg-slate-50 border-t border-slate-200/70">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Comprehensive Analytical Depth
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              STOCK X provides two complementary research engines: structured fundamental memos and dynamic interactive interrogation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Memo Column */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  01
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Unified Decision Memo</h3>
                  <p className="text-xs text-slate-500">7 Core Diagnostic Sections</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  'Company Profile & Capitalization Snapshot',
                  'Core Investment Thesis & Conviction Rating',
                  'Market Share & Competitive Moat Position',
                  'Financial Quality & Balance Sheet Constraints',
                  'Stress Testing & Downside Failure Modes',
                  'Recommended Actionable Next Steps',
                  'Full Disclosures & Verifiable Evidence Appendix',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 py-1.5 border-b border-slate-50 last:border-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DataPulse Column */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-[#3154e8]/10 text-[#3154e8] flex items-center justify-center font-bold">
                  02
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">DataPulse Agent Inquiries</h3>
                  <p className="text-xs text-slate-500">Interactive Drilldowns with Citations</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  'Dynamic Stock Question Suggestions',
                  'Earnings Guidance & Consensus Surprise Analysis',
                  'P/E, EV/EBITDA & Peer Benchmark Multiples',
                  'Free Cash Flow & Dividend Sustainability Checks',
                  'Balance Sheet Leverage & Refinancing Risks',
                  'Verifiable SEC/BSE Filing Citations',
                  'Multi-Turn Interactive Drilldown for Any Metric',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 py-1.5 border-b border-slate-50 last:border-0">
                    <CheckCircle2 className="w-4 h-4 text-[#3154e8] shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS (Workflow) ═══ */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
            How STOCK X Works
          </h2>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            From raw regulatory filings to executive investment memos in four streamlined steps.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Enter Ticker',
              desc: 'Input any listed stock symbol from US (NYSE/NASDAQ) or India (NSE/BSE).',
            },
            {
              step: '02',
              title: 'Synthesize Memo',
              desc: 'STOCK X ingests real-time filings, multiples, and financials into a structured memo.',
            },
            {
              step: '03',
              title: 'DataPulse Agent',
              desc: 'Interrogate valuation multiples, earnings drivers, and risks with citation-backed answers.',
            },
            {
              step: '04',
              title: 'Export DOCX',
              desc: 'Download a clean, formatted executive report containing the decision memo and Q&A thread.',
            },
          ].map((item, idx) => (
            <div key={idx} className="bg-[#f4f5f8] rounded-3xl p-7 border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[#3154e8] bg-[#3154e8]/10 px-2.5 py-1 rounded-full mb-4 inline-block">
                  {item.step}
                </span>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white py-14 px-6 text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-100">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 text-xl font-black text-slate-900 mb-4">
              <span>STOCK</span>
              <span className="text-[#3154e8]">X</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-4">
              Modern equity investment research and interactive DataPulse intelligence for retail investors, analysts, and institutional funds.
            </p>
            <div className="text-[11px] text-slate-400">
              Coverage across US (SEC EDGAR) & India (BSE / NSE)
            </div>
          </div>

          <div className="md:col-span-7 grid grid-cols-3 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
                Platform
              </h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#features" className="hover:text-slate-900">Decision Memo</a></li>
                <li><a href="#datapulse" className="hover:text-slate-900">DataPulse Agent</a></li>
                <li><button onClick={focusSearch} className="hover:text-slate-900 text-left cursor-pointer">Stock Search</button></li>
                <li><span className="text-slate-400">DOCX Export</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
                Markets
              </h4>
              <ul className="space-y-2 text-xs">
                <li><span className="text-slate-600">NSE / BSE (India)</span></li>
                <li><span className="text-slate-600">NYSE / NASDAQ (US)</span></li>
                <li><span className="text-slate-600">SEC EDGAR 10-K / 10-Q</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
                Audience
              </h4>
              <ul className="space-y-2 text-xs">
                <li><span className="text-slate-600">Retail Investors</span></li>
                <li><span className="text-slate-600">Portfolio Managers</span></li>
                <li><span className="text-slate-600">Equity Analysts</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© 2026 STOCK X Intelligence. All rights reserved.</p>
          <p>For research and investment analysis purposes only. Not personalized financial advice.</p>
        </div>
      </footer>

      {/* ═══ API KEY MODAL ═══ */}
      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => {
          setShowKeyModal(false)
          setPendingTicker(null)
        }}
        onSave={refreshKeyStatus}
        initialTicker={pendingTicker || undefined}
      />
    </div>
  )
}
