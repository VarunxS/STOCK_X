'use client'

import { useState, useEffect, useRef } from 'react'
import {
    clearInferenceConfig,
    getApiKey,
    getModelName,
    getProviderType,
    saveApiKey,
    saveModelName,
    saveProviderType,
} from '@/lib/data-store'
import {
    getDefaultModelForProvider,
    getModelOptions,
    getProviderOption,
    PROVIDER_OPTIONS,
    type InferenceProvider,
} from '@/lib/inference-catalog'
import { Key, Check, ShieldCheck, ClipboardPaste, Eye, EyeOff, Sparkles, X } from 'lucide-react'

interface ApiKeyModalProps {
    isOpen: boolean
    onClose: () => void
    onSave?: () => void
    initialTicker?: string
}

export function ApiKeyModal({ isOpen, onClose, onSave, initialTicker }: ApiKeyModalProps) {
    const [key, setKey] = useState('')
    const [providerType, setProviderType] = useState<InferenceProvider>('openrouter')
    const [modelName, setModelName] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [saved, setSaved] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const selectedProvider = getProviderOption(providerType)
    const modelOptions = getModelOptions(providerType)

    useEffect(() => {
        if (isOpen) {
            const existing = getApiKey() || ''
            const existingProvider = getProviderType()
            const existingModel = getModelName() || getDefaultModelForProvider(existingProvider)
            
            setKey(existing)
            setProviderType(existingProvider)
            setModelName(existingModel)
            setSaved(false)
            
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }, [isOpen])

    useEffect(() => {
        if (!modelOptions.some((option) => option.value === modelName)) {
            setModelName(modelOptions[0]?.value ?? getDefaultModelForProvider(providerType))
        }
    }, [providerType, modelName, modelOptions])

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText()
            if (text) {
                setKey(text.trim())
                setSaved(false)
            }
        } catch {
            // fallback if clipboard permissions denied
        }
    }

    const handleSave = () => {
        const trimmedKey = key.trim()
        if (!trimmedKey) return
        
        const finalModel = modelName.trim() || getDefaultModelForProvider(providerType)
        saveProviderType(providerType)
        saveApiKey(trimmedKey)
        saveModelName(finalModel)
        setSaved(true)
        onSave?.()
        setTimeout(() => {
            onClose()
        }, 500)
    }

    const handleClear = () => {
        clearInferenceConfig()
        setKey('')
        setSaved(false)
        onSave?.()
    }

    if (!isOpen) return null

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
            }}
        >
            <div 
                className="relative bg-white border border-slate-200/90 w-full max-w-lg shadow-2xl rounded-3xl overflow-hidden font-sans text-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#3154e8]/10 text-[#3154e8] flex items-center justify-center shrink-0">
                            <Key className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                                Configure Research Key
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {initialTicker ? `Required to synthesize ${initialTicker} decision memo` : 'Unlock live SEC & BSE filings and DataPulse Agent'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-all cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 bg-white">
                    {/* Provider Selection Tabs */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Select Provider
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {PROVIDER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setProviderType(option.value)
                                        setModelName(getDefaultModelForProvider(option.value))
                                        setSaved(false)
                                    }}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                                        providerType === option.value
                                            ? 'bg-[#3154e8] text-white border-[#3154e8] shadow-sm'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key Input */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                {selectedProvider.keyLabel}
                            </label>
                            <button
                                type="button"
                                onClick={handlePaste}
                                className="text-xs text-[#3154e8] hover:text-[#2545d8] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                                <ClipboardPaste className="w-3.5 h-3.5" />
                                <span>Paste</span>
                            </button>
                        </div>

                        <div className="relative">
                            <input
                                ref={inputRef}
                                type={showKey ? 'text' : 'password'}
                                value={key}
                                onChange={(e) => {
                                    setKey(e.target.value)
                                    setSaved(false)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleSave()
                                    }
                                }}
                                placeholder={selectedProvider.keyPlaceholder}
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 pr-20 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#3154e8] focus:ring-4 focus:ring-[#3154e8]/10 transition-all rounded-xl font-mono text-xs"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 font-medium px-2 py-1 rounded transition-colors cursor-pointer"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                            {selectedProvider.keyHelp} Keys are kept in your browser storage and passed directly to your local Python backend.
                        </p>
                    </div>

                    {/* Model Dropdown */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Model Selection
                        </label>
                        <select
                            value={modelName}
                            onChange={(e) => {
                                setModelName(e.target.value)
                                setSaved(false)
                            }}
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-[#3154e8] focus:ring-4 focus:ring-[#3154e8]/10 transition-all rounded-xl cursor-pointer"
                        >
                            {modelOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-500 mt-2">
                            {modelOptions.find((option) => option.value === modelName)?.note}
                        </p>
                    </div>

                    {saved && (
                        <div className="flex items-center gap-2 text-emerald-700 text-xs bg-emerald-50 p-3 rounded-xl border border-emerald-200 font-medium">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>API key saved successfully!</span>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-4 flex items-center justify-between border-t border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors cursor-pointer"
                    >
                        Clear Key
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!key.trim()}
                            className="bg-[#3154e8] hover:bg-[#2545d8] text-white px-7 py-2.5 text-xs font-semibold rounded-full shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            {saved ? (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Saved</span>
                                </>
                            ) : (
                                <span>Save & Continue</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
