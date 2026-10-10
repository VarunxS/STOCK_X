'use client'

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'

function AnalyzeContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tickerParam = searchParams.get('ticker')
    useEffect(() => {
        const ticker = tickerParam ? tickerParam.toUpperCase() : 'TITAN'
        router.replace(`/workspace/${encodeURIComponent(ticker)}`)
    }, [router, tickerParam])

    return (
        <div className="min-h-screen bg-[#f5f3ee]" />
    )
}

export default function AnalyzePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f5f3ee]" />}>
            <AnalyzeContent />
        </Suspense>
    )
}
