import { type Subprocess } from "bun"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ensureToken } from "./token.ts"

const HOST = process.env.LLMKARUSEL_HOST ?? "127.0.0.1"
const PORT = Number(process.env.LLMKARUSEL_PORT ?? "4127")

let child: Subprocess | undefined

function gatewayEntry() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "gateway.ts")
}

async function healthy(base: string) {
  const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) })
  return response.ok
}

/** Start the failover gateway inside this OpenCode process tree. Fails if health never succeeds. */
export async function ensureGateway(): Promise<{ host: string; port: number; baseURL: string; token: string }> {
  const token = ensureToken()
  const baseURL = `http://${HOST}:${PORT}/v1`

  if (process.env.LLMKARUSEL_GATEWAY === "0") {
    return { host: HOST, port: PORT, baseURL, token }
  }

  // Product default: keyless on when launched from the OpenCode fork embed path.
  if (process.env.LLMKARUSEL_KEYLESS === undefined) process.env.LLMKARUSEL_KEYLESS = "1"

  try {
    if (await healthy(`http://${HOST}:${PORT}`)) {
      return { host: HOST, port: PORT, baseURL, token }
    }
  } catch {
    // not running
  }

  child = Bun.spawn([process.execPath, "run", gatewayEntry()], {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      LLMKARUSEL_HOST: HOST,
      LLMKARUSEL_PORT: String(PORT),
      LLMKARUSEL_TOKEN: token,
      LLMKARUSEL_KEYLESS: process.env.LLMKARUSEL_KEYLESS ?? "1",
    },
    windowsHide: true,
  })

  let ready = false
  for (let i = 0; i < 50; i++) {
    try {
      if (await healthy(`http://${HOST}:${PORT}`)) {
        ready = true
        break
      }
    } catch {
      // retry
    }
    if (child.exitCode !== null) break
    await Bun.sleep(100)
  }

  if (!ready) {
    if (child && !child.killed) child.kill()
    child = undefined
    throw new Error(`llmkarusel gateway failed health check on ${baseURL}`)
  }

  const stop = () => {
    if (child && !child.killed) child.kill()
    child = undefined
  }
  process.once("exit", stop)
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)

  return { host: HOST, port: PORT, baseURL, token }
}

export function gatewayBaseURL() {
  return `http://${HOST}:${PORT}/v1`
}
