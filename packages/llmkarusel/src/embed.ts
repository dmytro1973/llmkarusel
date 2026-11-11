import { type Subprocess } from "bun"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HOST = process.env.LLMKARUSEL_HOST ?? "127.0.0.1"
const PORT = Number(process.env.LLMKARUSEL_PORT ?? "4127")

let child: Subprocess | undefined

function gatewayEntry() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "gateway.ts")
}

/** Start the failover gateway inside this OpenCode process tree. */
export async function ensureGateway(): Promise<{ host: string; port: number; baseURL: string }> {
  if (process.env.LLMKARUSEL_GATEWAY === "0") {
    return { host: HOST, port: PORT, baseURL: `http://${HOST}:${PORT}/v1` }
  }

  try {
    const health = await fetch(`http://${HOST}:${PORT}/health`, { signal: AbortSignal.timeout(500) })
    if (health.ok) return { host: HOST, port: PORT, baseURL: `http://${HOST}:${PORT}/v1` }
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
    },
    windowsHide: true,
  })

  for (let i = 0; i < 40; i++) {
    try {
      const health = await fetch(`http://${HOST}:${PORT}/health`, { signal: AbortSignal.timeout(500) })
      if (health.ok) break
    } catch {
      await Bun.sleep(100)
    }
  }

  const stop = () => {
    if (child && !child.killed) child.kill()
    child = undefined
  }
  process.once("exit", stop)
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)

  return { host: HOST, port: PORT, baseURL: `http://${HOST}:${PORT}/v1` }
}

export function gatewayBaseURL() {
  return `http://${HOST}:${PORT}/v1`
}
