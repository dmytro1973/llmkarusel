import { scanClipboard, scanText } from "./clipboard.ts"
import { runKarusel, type ChatBody } from "./karusel.ts"
import { type BoundRoute, providerLabel, scanKeys } from "./key-lane.ts"
import { authorize, ensureToken, readToken } from "./token.ts"

function resolveHost() {
  const host = process.env.LLMKARUSEL_HOST ?? "127.0.0.1"
  const loopback = host === "127.0.0.1" || host === "::1" || host === "localhost"
  if (!loopback && process.env.LLMKARUSEL_INSECURE_BIND !== "1") {
    throw new Error("llmkarusel: non-loopback bind requires LLMKARUSEL_INSECURE_BIND=1")
  }
  return host
}

const HOST = resolveHost()
const PORT = Number(process.env.LLMKARUSEL_PORT ?? "4127")
const TOKEN = ensureToken()
const KEYLESS = process.env.LLMKARUSEL_KEYLESS === "1"

const state = {
  routes: [] as BoundRoute[],
}

function mergeRoutes(incoming: BoundRoute[], mode: "replace" | "fill" = "replace") {
  const byId = new Map(state.routes.map((route) => [route.id, route]))
  for (const route of incoming) {
    if (mode === "fill" && byId.has(route.id)) continue
    byId.set(route.id, route)
  }
  state.routes = ["openrouter", "google", "groq", "nvidia"].flatMap((id) => {
    const route = byId.get(id as BoundRoute["id"])
    return route ? [route] : []
  })
}

function labels() {
  return state.routes.map((route) => providerLabel(route.id))
}

async function ingestClipboard(mode: "replace" | "fill" = "fill") {
  try {
    const scan = await scanClipboard()
    if (scan.routes.length) mergeRoutes(scan.routes, mode)
  } catch {
    // Clipboard may be empty or blocked.
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  })
}

function unauthorized() {
  return json({ error: "unauthorized" }, 401)
}

async function handleKeys(request: Request) {
  let posted = false
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { text?: string; keys?: string[] }
    if (typeof body.text === "string" && body.text.length) {
      mergeRoutes(scanText(body.text).routes, "replace")
      posted = true
    }
    if (Array.isArray(body.keys)) {
      for (const key of body.keys) {
        if (typeof key === "string" && key.length) {
          mergeRoutes(scanKeys(key), "replace")
          posted = true
        }
      }
    }
  } else {
    const text = await request.text()
    if (text.length) {
      mergeRoutes(scanText(text).routes, "replace")
      posted = true
    }
  }
  // Clipboard may fill missing providers only — never overwrite a just-posted key.
  await ingestClipboard("fill")
  return json({ ok: true, providers: labels(), posted })
}

async function handleChat(request: Request) {
  await ingestClipboard("fill")
  const body = (await request.json()) as ChatBody
  if (!body?.messages) return json({ error: "messages required" }, 400)

  const result = await runKarusel({
    keys: state.routes,
    body,
    keyless: KEYLESS,
    signal: request.signal,
  })

  if (!result.ok) {
    return json(
      {
        error: {
          message: KEYLESS
            ? "llmkarusel: alle Routen fehlgeschlagen"
            : "llmkarusel: keine Route (Keyless aus — LLMKARUSEL_KEYLESS=1 zum Aktivieren)",
          type: "failover_exhausted",
          attempts: result.attempts,
        },
      },
      502,
    )
  }

  const headers = new Headers({
    "x-llmkarusel-route": result.route ?? "",
    "x-llmkarusel-attempts": String(result.attempts.length),
    "cache-control": "no-store",
  })

  if (body.stream && result.response) {
    headers.set("content-type", result.response.headers.get("content-type") ?? "text/event-stream")
    return new Response(result.response.body, { status: 200, headers })
  }

  headers.set("content-type", "application/json")
  return new Response(JSON.stringify(result.body), { status: 200, headers })
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url)
    const publicHealth =
      request.method === "GET" && (url.pathname === "/health" || url.pathname === "/v1/health")

    if (publicHealth) {
      return json({ ok: true, providers: labels(), name: "llmkarusel", keyless: KEYLESS })
    }

    if (!authorize(request, readToken() ?? TOKEN)) return unauthorized()

    if (request.method === "POST" && (url.pathname === "/v1/keys" || url.pathname === "/keys")) {
      return handleKeys(request)
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      return handleChat(request)
    }

    if (request.method === "GET" && url.pathname === "/v1/models") {
      return json({
        object: "list",
        data: [{ id: "auto", object: "model", owned_by: "llmkarusel" }],
      })
    }

    return json({ error: "not found" }, 404)
  },
})

await ingestClipboard("fill")
console.log(`llmkarusel gateway http://${server.hostname}:${server.port}/v1`)
if (labels().length) console.log(`gebunden: ${labels().join(", ")}`)
else if (KEYLESS) console.log("kein Schlüssel — keyless-Kette aktiv (LLMKARUSEL_KEYLESS=1)")
else console.log("kein Schlüssel — keyless aus (setze LLMKARUSEL_KEYLESS=1)")
