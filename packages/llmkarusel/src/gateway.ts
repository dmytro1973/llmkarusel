import { scanClipboard, scanText } from "./clipboard.ts"
import { runKarusel, type ChatBody } from "./karusel.ts"
import { type BoundRoute, providerLabel, scanKeys } from "./key-lane.ts"

const HOST = process.env.LLMKARUSEL_HOST ?? "127.0.0.1"
const PORT = Number(process.env.LLMKARUSEL_PORT ?? "4127")

const state = {
  routes: [] as BoundRoute[],
}

function mergeRoutes(incoming: BoundRoute[]) {
  const byId = new Map(state.routes.map((route) => [route.id, route]))
  for (const route of incoming) byId.set(route.id, route)
  state.routes = ["openrouter", "google", "groq", "nvidia"].flatMap((id) => {
    const route = byId.get(id as BoundRoute["id"])
    return route ? [route] : []
  })
}

function labels() {
  return state.routes.map((route) => providerLabel(route.id))
}

async function ingestClipboard() {
  try {
    const scan = await scanClipboard()
    if (scan.routes.length) mergeRoutes(scan.routes)
  } catch {
    // Clipboard may be empty or blocked; keyless still works.
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  })
}

async function handleKeys(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { text?: string; keys?: string[] }
    if (typeof body.text === "string") mergeRoutes(scanText(body.text).routes)
    if (Array.isArray(body.keys)) {
      for (const key of body.keys) {
        if (typeof key === "string") mergeRoutes(scanKeys(key))
      }
    }
  } else {
    const text = await request.text()
    mergeRoutes(scanText(text).routes)
  }
  await ingestClipboard()
  return json({ ok: true, providers: labels() })
}

async function handleChat(request: Request) {
  await ingestClipboard()
  const body = (await request.json()) as ChatBody
  if (!body?.messages) return json({ error: "messages required" }, 400)

  const result = await runKarusel({
    keys: state.routes,
    body,
    signal: request.signal,
  })

  if (!result.ok) {
    return json(
      {
        error: {
          message: "llmkarusel: alle Routen fehlgeschlagen",
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
    "access-control-allow-origin": "*",
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
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type, authorization",
          "access-control-allow-methods": "GET, POST, OPTIONS",
        },
      })
    }

    const url = new URL(request.url)

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/v1/health")) {
      return json({ ok: true, providers: labels(), name: "llmkarusel" })
    }

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

await ingestClipboard()
console.log(`llmkarusel gateway http://${server.hostname}:${server.port}/v1`)
if (labels().length) console.log(`gebunden: ${labels().join(", ")}`)
else console.log("kein Schlüssel in der Zwischenablage — keyless-Kette aktiv")
