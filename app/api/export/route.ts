import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const BACKEND_URL = process.env.VERDICT_BACKEND_URL || process.env.STOCKX_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/workspace/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            workspace_id: body.workspaceId,
        }),
    })

    const payload = await response.json()
    if (!response.ok) {
        return Response.json(
            { success: false, error: payload.detail || payload.error || 'Export failed' },
            { status: response.status }
        )
    }

    const bytes = Buffer.from(payload.content, 'hex')
    return new Response(bytes, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${payload.filename || 'stockx-workspace.docx'}"`,
        },
    })
}
