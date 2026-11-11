import { type BoundRoute, providerLabel, scanKeys } from "./key-lane.ts"

export type ClipboardScan = {
  readonly routes: BoundRoute[]
  readonly labels: string[]
}

/** Read OS clipboard text. Never returns the raw clipboard to callers that only need bindings. */
export async function readClipboardText(): Promise<string> {
  const browser = globalThis as {
    navigator?: { clipboard?: { readText?: () => Promise<string> } }
  }
  if (browser.navigator?.clipboard?.readText) {
    try {
      return await browser.navigator.clipboard.readText()
    } catch {
      // Browser gesture / permission; caller may use paste fallback.
    }
  }

  if (process.platform === "win32") {
    const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const text = await new Response(proc.stdout).text()
    await proc.exited
    return text.replace(/\r\n/g, "\n")
  }

  if (process.platform === "darwin") {
    const proc = Bun.spawn(["pbpaste"], { stdout: "pipe", stderr: "pipe" })
    const text = await new Response(proc.stdout).text()
    await proc.exited
    return text
  }

  const proc = Bun.spawn(["xclip", "-selection", "clipboard", "-o"], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const text = await new Response(proc.stdout).text()
  const code = await proc.exited
  if (code === 0) return text

  const wl = Bun.spawn(["wl-paste", "-n"], { stdout: "pipe", stderr: "pipe" })
  const wlText = await new Response(wl.stdout).text()
  await wl.exited
  return wlText
}

export async function scanClipboard(): Promise<ClipboardScan> {
  const text = await readClipboardText()
  const routes = scanKeys(text)
  return {
    routes,
    labels: routes.map((route) => providerLabel(route.id)),
  }
}

export function scanText(text: string): ClipboardScan {
  const routes = scanKeys(text)
  return {
    routes,
    labels: routes.map((route) => providerLabel(route.id)),
  }
}
