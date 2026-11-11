import { type BoundRoute, scanKeys } from "./key-lane.ts"

export type KeylessRoute = {
  readonly id: string
  readonly endpoint: string
  readonly model: string
  readonly key?: string
}

export type Attempt = {
  readonly id: string
  readonly ok: boolean
  readonly status?: number
  readonly error?: string
}

export type KaruselResult = {
  readonly ok: boolean
  readonly route?: string
  readonly attempts: Attempt[]
  readonly response?: Response
  readonly body?: unknown
}

export const KEYLESS: readonly KeylessRoute[] = [
  {
    id: "keylessai/openai-fast",
    endpoint: "https://keylessai.thryx.workers.dev/v1/chat/completions",
    model: "openai-fast",
  },
  {
    id: "pollinations/gpt-oss-20b",
    endpoint: "https://text.pollinations.ai/openai/chat/completions",
    model: "gpt-oss-20b",
  },
  {
    id: "pollinations/openai",
    endpoint: "https://text.pollinations.ai/openai/chat/completions",
    model: "openai",
  },
]

const DEFAULT_TIMEOUT_MS = 45_000

export type ChatBody = {
  model?: string
  messages: unknown[]
  stream?: boolean
  [key: string]: unknown
}

export type RunOptions = {
  readonly keys?: readonly string[] | readonly BoundRoute[]
  readonly clipboardText?: string
  readonly body: ChatBody
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

function routesFromKeys(keys: RunOptions["keys"], clipboardText?: string): BoundRoute[] {
  const bound: BoundRoute[] = []
  const seen = new Set<string>()

  const push = (route: BoundRoute) => {
    if (seen.has(route.id)) return
    seen.add(route.id)
    bound.push(route)
  }

  if (keys) {
    for (const item of keys) {
      if (typeof item === "string") {
        for (const route of scanKeys(item)) push(route)
      } else {
        push(item)
      }
    }
  }

  if (clipboardText) {
    for (const route of scanKeys(clipboardText)) push(route)
  }

  return bound
}

function buildChain(keys: RunOptions["keys"], clipboardText?: string) {
  const keyed = routesFromKeys(keys, clipboardText).map((route) => ({
    id: route.id,
    endpoint: route.endpoint,
    model: route.model,
    key: route.key,
  }))
  return [...keyed, ...KEYLESS]
}

async function tryRoute(
  route: { id: string; endpoint: string; model: string; key?: string },
  body: ChatBody,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Attempt & { response?: Response }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: body.stream ? "text/event-stream" : "application/json",
    }
    if (route.key) headers.authorization = `Bearer ${route.key}`

    const payload = {
      ...body,
      model: route.model,
    }

    const response = await fetch(route.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      // Drain briefly so sockets can close; never log body (may contain echoes).
      await response.text().catch(() => undefined)
      return {
        id: route.id,
        ok: false,
        status: response.status,
        error: `http_${response.status}`,
      }
    }

    return { id: route.id, ok: true, status: response.status, response }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError" || String(error.message).includes("timeout")
          ? "timeout"
          : "network"
        : "network"
    return { id: route.id, ok: false, error: message }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

/** Real fetch failover across keyed lanes then keyless routes. */
export async function runKarusel(options: RunOptions): Promise<KaruselResult> {
  const attempts: Attempt[] = []
  const chain = buildChain(options.keys, options.clipboardText)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  for (const route of chain) {
    const result = await tryRoute(route, options.body, timeoutMs, options.signal)
    attempts.push({
      id: result.id,
      ok: result.ok,
      status: result.status,
      error: result.error,
    })
    if (!result.ok || !result.response) continue

    if (options.body.stream) {
      return {
        ok: true,
        route: result.id,
        attempts,
        response: result.response,
      }
    }

    const body = await result.response.json().catch(() => undefined)
    if (body === undefined) {
      attempts[attempts.length - 1] = {
        id: result.id,
        ok: false,
        status: result.status,
        error: "invalid_json",
      }
      continue
    }

    return {
      ok: true,
      route: result.id,
      attempts,
      body,
      response: result.response,
    }
  }

  return { ok: false, attempts }
}
