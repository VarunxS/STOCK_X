import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.VERDICT_BACKEND_URL || process.env.STOCKX_BACKEND_URL || 'http://localhost:8000'

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
    if (lower.includes('error code: 404') || lower.includes('no longer available') || (lower.includes('model') && lower.includes('not found'))) {
        return `The model ${modelName} is unavailable on ${providerType}. Pick another model in Inference settings and try again.`
    }
    return rawError
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        if (!body.apiKey || !body.providerType || !body.modelName) {
            return NextResponse.json(
                { success: false, error: 'Inference provider, API key, and model are required' },
                { status: 400 }
            )
        }
        if (!body.workspaceId) {
            return NextResponse.json(
                { success: false, error: 'Workspace ID is required' },
                { status: 400 }
            )
        }

        // If action is suggest-questions
        if (body.action === 'suggest') {
            const response = await fetch(`${BACKEND_URL}/workspace/suggest-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_id: body.workspaceId,
                    provider_type: body.providerType,
                    api_keys: { [body.providerType]: body.apiKey },
                    model_name: body.modelName,
                }),
            })
            const raw = await response.text()
            let payload: any = null
            try {
                payload = raw ? JSON.parse(raw) : {}
            } catch {
                payload = null
            }
            if (!response.ok) {
                return NextResponse.json(
                    {
                        success: false,
                        error: formatProviderError(
                            payload?.detail || payload?.error || raw || 'Failed to suggest questions',
                            body.providerType,
                            body.modelName,
                        ),
                    },
                    { status: response.status }
                )
            }
            return NextResponse.json({ success: true, ...payload })
        }

        // Default: RAG Q&A
        if (!body.question || !body.question.trim()) {
            return NextResponse.json(
                { success: false, error: 'Question is required' },
                { status: 400 }
            )
        }

        const response = await fetch(`${BACKEND_URL}/workspace/qa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_id: body.workspaceId,
                question: body.question.trim(),
                chat_history: body.chatHistory || [],
                provider_type: body.providerType,
                api_keys: { [body.providerType]: body.apiKey },
                model_name: body.modelName,
            }),
        })

        const raw = await response.text()
        let payload: any = null
        try {
            payload = raw ? JSON.parse(raw) : {}
        } catch {
            payload = null
        }

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: formatProviderError(
                        payload?.detail || payload?.error || raw || 'Q&A request failed',
                        body.providerType,
                        body.modelName,
                    ),
                },
                { status: response.status }
            )
        }

        if (!payload || typeof payload !== 'object') {
            return NextResponse.json(
                { success: false, error: raw || 'Q&A request failed' },
                { status: 502 }
            )
        }

        return NextResponse.json({ success: true, ...payload })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Q&A request failed' },
            { status: 500 }
        )
    }
}
