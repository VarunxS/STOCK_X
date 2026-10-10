export interface MemoSection {
  summary: string
  bullets: string[]
}

export interface MemoSource {
  title: string
  url: string
  relevance: string
}

export interface UnifiedMemo {
  title: string
  company_snapshot: {
    company: string
    ticker: string
    sector: string
    market: string
    summary: string
    highlights: string[]
  }
  core_thesis: MemoSection
  market_and_competitive_position: MemoSection
  financial_quality_and_constraints: MemoSection
  key_risks_and_stress_points: MemoSection
  recommended_next_moves: MemoSection
  evidence_and_sources: MemoSource[]
}

export interface SourceSummary {
  sourceCount: number
  filingSourceCount: number
  hasFilings: boolean
}

export interface CoverageStatus {
  market: string
  resolvedSymbol: string
  filings: string
  workspaceMode: string
}

export interface WorkspaceSource {
  title: string
  url: string
  published: string
  domain: string
  snippet: string
}

export interface QAEvidence {
  title: string
  url?: string
  reason?: string
}

export interface QAInteraction {
  id: string
  question: string
  answer: string
  key_takeaways?: string[]
  evidence_used?: QAEvidence[]
  suggested_followups?: string[]
  timestamp: string
}

// Deprecated scenario interface retained for backward compatibility
export interface ScenarioOutput {
  proposal: string
  why_this_could_work: string[]
  expected_upside: string[]
  financial_impact: string[]
  strategic_impact: string[]
  operational_consequences: string[]
  risks_and_failure_modes: string[]
  stress_triggers_to_monitor: string[]
  recommendation: string
  evidence_used: Array<{
    title: string
    url: string
    reason: string
  }>
}

export interface WorkspacePayload {
  workspaceId: string
  memo: UnifiedMemo
  sourceSummary: SourceSummary
  coverageStatus: CoverageStatus
  sources: WorkspaceSource[]
  suggestedQuestions?: string[]
  expiresAt: string
}

export interface WorkspaceSession extends WorkspacePayload {
  ticker: string
  qaHistory: QAInteraction[]
  suggestedQuestions: string[]
  latestScenario?: ScenarioOutput | null
}
