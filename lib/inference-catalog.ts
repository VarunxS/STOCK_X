export type InferenceProvider = 'openrouter' | 'openai' | 'gemini'

export interface ModelOption {
  value: string
  label: string
  note: string
}

export interface ProviderOption {
  value: InferenceProvider
  label: string
  keyLabel: string
  keyPlaceholder: string
  keyHelp: string
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'openrouter',
    label: 'OpenRouter',
    keyLabel: 'OpenRouter API Key',
    keyPlaceholder: 'sk-or-v1-...',
    keyHelp: 'Use OpenRouter when you want one key with cross-provider model access.',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
    keyHelp: 'Use your direct OpenAI API key for native OpenAI model access. Note: key scopes and model entitlement are separate, so some OpenAI models may still be unavailable to a given project.',
  },
  {
    value: 'gemini',
    label: 'Gemini',
    keyLabel: 'Gemini API Key',
    keyPlaceholder: 'AIza...',
    keyHelp: 'Use your Google AI Studio Gemini key for direct Gemini access.',
  },
]

export const MODEL_OPTIONS_BY_PROVIDER: Record<InferenceProvider, ModelOption[]> = {
  openrouter: [
    {
      value: 'openai/gpt-4o-mini',
      label: 'GPT-4o Mini',
      note: 'Recommended for affordable analysis and DataPulse queries via OpenRouter.',
    },
    {
      value: 'anthropic/claude-sonnet-4',
      label: 'Claude Sonnet',
      note: 'Anthropic via OpenRouter.',
    },
    {
      value: 'google/gemini-3.5-flash',
      label: 'Gemini Flash 3.5',
      note: 'Google Gemini via OpenRouter.',
    },
    {
      value: 'google/gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro Preview',
      note: 'Preview Gemini reasoning model via OpenRouter.',
    },
    {
      value: 'openai/gpt-5.6-terra',
      label: 'GPT-5.6 Terra',
      note: 'Balanced OpenAI model via OpenRouter.',
    },
  ],
  openai: [
    {
      value: 'gpt-4.1-mini',
      label: 'GPT-4.1 Mini',
      note: 'Recommended first choice for direct OpenAI access when newer frontier models are restricted on your project.',
    },
    {
      value: 'gpt-4.1',
      label: 'GPT-4.1',
      note: 'Stronger general-purpose model with broader project availability than some frontier-only options.',
    },
    {
      value: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      note: 'Low-cost fallback for direct OpenAI usage.',
    },
    {
      value: 'gpt-5.6',
      label: 'GPT-5.6',
      note: 'Current flagship OpenAI model, but some projects may not have access yet.',
    },
  ],
  gemini: [
    {
      value: 'gemini-3.5-flash',
      label: 'Gemini Flash 3.5',
      note: 'Current stable Gemini 3.5 Flash.',
    },
    {
      value: 'gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro Preview',
      note: 'Preview model for stronger reasoning and coding.',
    },
    {
      value: 'gemini-3.1-flash-lite',
      label: 'Gemini Flash 3.1 Lite',
      note: 'Fast, lower-cost Gemini 3.1 option.',
    },
    {
      value: 'gemini-3-flash-preview',
      label: 'Gemini 3 Flash Preview',
      note: 'Preview Gemini Flash model for newer generation coverage.',
    },
  ],
}

export function getProviderOption(provider: InferenceProvider): ProviderOption {
  return PROVIDER_OPTIONS.find((option) => option.value === provider) ?? PROVIDER_OPTIONS[0]
}

export function getModelOptions(provider: InferenceProvider): ModelOption[] {
  return MODEL_OPTIONS_BY_PROVIDER[provider]
}

export function isSupportedModelForProvider(
  provider: InferenceProvider,
  modelName: string | null | undefined,
): boolean {
  if (!modelName) return false
  return MODEL_OPTIONS_BY_PROVIDER[provider].some((option) => option.value === modelName)
}

export function getDefaultModelForProvider(provider: InferenceProvider): string {
  return MODEL_OPTIONS_BY_PROVIDER[provider][0]?.value ?? ''
}
