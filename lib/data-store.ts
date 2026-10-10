import type { WorkspaceSession } from '@/lib/workspace'
import {
    getDefaultModelForProvider,
    isSupportedModelForProvider,
    type InferenceProvider,
} from '@/lib/inference-catalog'

export const API_KEY_KEY = 'stockx_inference_key'
export const MODEL_KEY_KEY = 'stockx_inference_model'
export const PROVIDER_TYPE_KEY = 'stockx_inference_provider'
const WORKSPACE_PREFIX = 'stockx_workspace_'

// Legacy keys for seamless migration
const LEGACY_API_KEY_KEY = 'verdict_inference_key'
const LEGACY_MODEL_KEY_KEY = 'verdict_inference_model'
const LEGACY_PROVIDER_TYPE_KEY = 'verdict_inference_provider'
const LEGACY_WORKSPACE_PREFIX = 'verdict_workspace_'

function setDualStorage(key: string, value: string) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(key, value)
    } catch {}
    try {
        sessionStorage.setItem(key, value)
    } catch {}
}

function getDualStorage(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
        const val = localStorage.getItem(key)
        if (val) return val
    } catch {}
    try {
        return sessionStorage.getItem(key)
    } catch {}
    return null
}

function removeDualStorage(key: string) {
    if (typeof window === 'undefined') return
    try {
        localStorage.removeItem(key)
    } catch {}
    try {
        sessionStorage.removeItem(key)
    } catch {}
}

export function saveApiKey(key: string) {
    setDualStorage(API_KEY_KEY, key)
}

export function getApiKey(): string | null {
    return getDualStorage(API_KEY_KEY) || getDualStorage(LEGACY_API_KEY_KEY)
}

export function clearApiKey() {
    removeDualStorage(API_KEY_KEY)
    removeDualStorage(LEGACY_API_KEY_KEY)
}

export function saveProviderType(provider: InferenceProvider) {
    setDualStorage(PROVIDER_TYPE_KEY, provider)
}

export function getProviderType(): InferenceProvider {
    const stored = getDualStorage(PROVIDER_TYPE_KEY) || getDualStorage(LEGACY_PROVIDER_TYPE_KEY)
    if (stored === 'openai' || stored === 'gemini' || stored === 'openrouter') {
        return stored
    }
    return 'openrouter'
}

export function clearProviderType() {
    removeDualStorage(PROVIDER_TYPE_KEY)
    removeDualStorage(LEGACY_PROVIDER_TYPE_KEY)
}

export function saveModelName(model: string) {
    setDualStorage(MODEL_KEY_KEY, model)
}

export function getModelName(): string | null {
    const stored = getDualStorage(MODEL_KEY_KEY) || getDualStorage(LEGACY_MODEL_KEY_KEY)
    const provider = getProviderType()
    if (stored && isSupportedModelForProvider(provider, stored)) {
        return stored
    }

    const fallback = getDefaultModelForProvider(provider)
    if (fallback) {
        saveModelName(fallback)
        return fallback
    }

    return stored || null
}

export function clearModelName() {
    removeDualStorage(MODEL_KEY_KEY)
    removeDualStorage(LEGACY_MODEL_KEY_KEY)
}

export function isInferenceConfigured(): boolean {
    const key = getApiKey()
    const provider = getProviderType()
    return !!provider && !!key && key.trim().length > 3
}

export function clearInferenceConfig() {
    clearProviderType()
    clearApiKey()
    clearModelName()
}

function workspaceKey(ticker: string): string {
    return `${WORKSPACE_PREFIX}${ticker.toUpperCase()}`
}

function legacyWorkspaceKey(ticker: string): string {
    return `${LEGACY_WORKSPACE_PREFIX}${ticker.toUpperCase()}`
}

export function saveWorkspaceSession(ticker: string, session: WorkspaceSession) {
    if (typeof window === 'undefined') return
    try {
        sessionStorage.setItem(workspaceKey(ticker), JSON.stringify(session))
    } catch (e) {
        console.error('Failed to save workspace session', e)
    }
}

export function getWorkspaceSession(ticker: string): WorkspaceSession | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = sessionStorage.getItem(workspaceKey(ticker)) || sessionStorage.getItem(legacyWorkspaceKey(ticker))
        if (!raw) return null
        const parsed = JSON.parse(raw) as WorkspaceSession
        if (Date.parse(parsed.expiresAt) <= Date.now()) {
            sessionStorage.removeItem(workspaceKey(ticker))
            sessionStorage.removeItem(legacyWorkspaceKey(ticker))
            return null
        }
        if (!parsed.qaHistory) {
            parsed.qaHistory = []
        }
        return parsed
    } catch (e) {
        console.error('Failed to load workspace session', e)
        return null
    }
}

export function clearWorkspaceSession(ticker: string) {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(workspaceKey(ticker))
    sessionStorage.removeItem(legacyWorkspaceKey(ticker))
}
