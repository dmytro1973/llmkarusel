import { randomBytes, timingSafeEqual } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export function tokenPath() {
  return process.env.LLMKARUSEL_TOKEN_FILE ?? path.join(os.tmpdir(), "llmkarusel-gateway.token")
}

/** Ensure a gateway shared secret exists in env (and a local file for same-machine helpers). */
export function ensureToken(): string {
  const existing = process.env.LLMKARUSEL_TOKEN?.trim()
  if (existing) {
    writeTokenFile(existing)
    return existing
  }
  const generated = randomBytes(32).toString("base64url")
  process.env.LLMKARUSEL_TOKEN = generated
  writeTokenFile(generated)
  return generated
}

function writeTokenFile(token: string) {
  const file = tokenPath()
  try {
    fs.writeFileSync(file, token, { encoding: "utf8", mode: 0o600 })
  } catch {
    // Best-effort; env alone is enough for parent/child.
  }
}

export function readToken(): string | undefined {
  const fromEnv = process.env.LLMKARUSEL_TOKEN?.trim()
  if (fromEnv) return fromEnv
  try {
    const text = fs.readFileSync(tokenPath(), "utf8").trim()
    return text || undefined
  } catch {
    return undefined
  }
}

export function authorize(request: Request, token: string | undefined): boolean {
  if (!token) return false
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const presented = match?.[1]
  if (!presented) return false
  const got = Buffer.from(presented)
  const want = Buffer.from(token)
  if (got.length !== want.length) return false
  return timingSafeEqual(got, want)
}
