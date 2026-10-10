import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // 5 minutes

const BACKEND_URL = process.env.VERDICT_BACKEND_URL || 'http://localhost:8000'

function formatProviderError(rawError: string, providerType: string, modelName: string): string {
    const lower = rawError.toLowerCase()
    if (lower.includes('insufficient permissions')) {
        if (providerType === 'openai') {
            return `Your OpenAI key is valid, but this project does not have access to ${modelName}. Try GPT-4.1 Mini first, switch to another OpenAI model, or use OpenRouter instead.`
        }
        return `Your ${providerType} API key does not have access to ${modelName}. Choose a different model, switch provider, or use a key/project with model access.`
    }
    if (lower.includes('error code: 401')) {
        return `Authentication failed for ${providerType} with model ${modelName}. Recheck the API key and provider selection.`
    }
    if (lower.includes('error code: 404') || lower.includes('no longer available') || lower.includes('model') && lower.includes('not found')) {
        return `The model ${modelName} is unavailable on ${providerType}. Pick another model in Inference settings and try again.`
    }
    return `Backend failed: ${rawError}`
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const ticker = body.ticker
        const apiKey = body.apiKey
        const providerType = body.providerType
        const modelName = body.modelName

        if (!ticker) {
            return NextResponse.json({ success: false, error: 'No ticker provided' }, { status: 400 })
        }

        if (!apiKey || !providerType || !modelName) {
            return NextResponse.json(
                { success: false, error: 'Inference provider, API key, and model are required' },
                { status: 400 }
            )
        }

        const endpoint = `${BACKEND_URL}/workspace/analyze`

        console.log(`[VERDICT API] Calling backend: ${endpoint} for ticker: ${ticker}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

        const backendBody: Record<string, any> = { ticker: ticker.toUpperCase() }
        backendBody.provider_type = providerType
        backendBody.api_keys = { [providerType]: apiKey }
        backendBody.model_name = modelName

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendBody),
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        console.log(`[VERDICT API] Backend response status: ${response.status}`)

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[VERDICT API] Backend failed: ${response.status} - ${errorText}`)
            return NextResponse.json(
                { success: false, error: formatProviderError(`${response.status} - ${errorText}`, providerType, modelName) },
                { status: 502 }
            )
        }

        const data = await response.json()
        console.log(`[VERDICT API] Success! Workspace created: ${data.workspaceId}`)

        return NextResponse.json({ success: true, ...data })

    } catch (error: any) {
        const msg = error?.message || String(error)
        console.error(`[VERDICT API] Error:`, msg, error?.cause)

        if (error?.name === 'AbortError') {
            return NextResponse.json({ success: false, error: 'Analysis timed out (5 min). Is the Python backend running?' }, { status: 504 })
        }

        if (msg.includes('ECONNREFUSED') || error?.cause?.message?.includes('ECONNREFUSED')) {
            return NextResponse.json(
                { success: false, error: 'Cannot connect to Python backend at localhost:8000. Start it with: python3 main.py' },
                { status: 503 }
            )
        }

        return NextResponse.json(
            { success: false, error: `Server error: ${error?.cause?.message || msg}` },
            { status: 500 }
        )
    }
}
