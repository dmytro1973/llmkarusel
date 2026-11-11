export type ProviderId = "openrouter" | "google" | "groq" | "nvidia"

export type BoundRoute = {
  readonly id: ProviderId
  readonly key: string
  readonly endpoint: string
  readonly model: string
}

type Format = {
  readonly id: ProviderId
  readonly pattern: RegExp
  readonly endpoint: string
  readonly model: string
}

/** One source for key formats and API binding. Exact whole-token match only. */
export const FORMATS: readonly Format[] = [
  {
    id: "openrouter",
    pattern: /(?<![A-Za-z0-9_-])sk-or-v1-[a-f0-9]{64}(?![A-Za-z0-9_-])/g,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/free",
  },
  {
    id: "google",
    pattern: /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_-])/g,
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  },
  {
    id: "groq",
    pattern: /(?<![A-Za-z0-9_-])gsk_[0-9A-Za-z]{52}(?![A-Za-z0-9_-])/g,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-20b",
  },
  {
    id: "nvidia",
    pattern: /(?<![A-Za-z0-9_-])nvapi-[0-9A-Za-z_-]{64}(?![A-Za-z0-9_-])/g,
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    model: "meta/llama-3.1-8b-instruct",
  },
]

const ORDER: readonly ProviderId[] = ["openrouter", "google", "groq", "nvidia"]

export function scanKeys(text: string): BoundRoute[] {
  if (!text) return []
  const found = new Map<ProviderId, BoundRoute>()
  for (const format of FORMATS) {
    format.pattern.lastIndex = 0
    const match = format.pattern.exec(text)
    if (!match) continue
    if (found.has(format.id)) continue
    found.set(format.id, {
      id: format.id,
      key: match[0],
      endpoint: format.endpoint,
      model: format.model,
    })
  }
  return ORDER.flatMap((id) => {
    const route = found.get(id)
    return route ? [route] : []
  })
}

export function providerLabel(id: ProviderId): string {
  switch (id) {
    case "openrouter":
      return "OpenRouter"
    case "google":
      return "Google"
    case "groq":
      return "Groq"
    case "nvidia":
      return "NVIDIA"
  }
}
