import { onCleanup, onMount } from "solid-js"

const GATEWAY = "http://127.0.0.1:4127"

const PATTERNS = [
  /(?<![A-Za-z0-9_-])sk-or-v1-[a-f0-9]{64}(?![A-Za-z0-9_-])/,
  /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_-])/,
  /(?<![A-Za-z0-9_-])gsk_[0-9A-Za-z]{52}(?![A-Za-z0-9_-])/,
  /(?<![A-Za-z0-9_-])nvapi-[0-9A-Za-z_-]{64}(?![A-Za-z0-9_-])/,
]

function looksLikeKey(text: string) {
  return PATTERNS.some((pattern) => pattern.test(text))
}

async function postKeys(text: string) {
  if (!text || !looksLikeKey(text)) return
  try {
    await fetch(`${GATEWAY}/v1/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
  } catch {
    // Gateway may not be up yet; CLI clipboard path still applies.
  }
}

async function readClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    await postKeys(text)
  } catch {
    // Needs a user gesture in many browsers; paste handler covers that.
  }
}

/**
 * Overnimmt API-Keys aus Zwischenablage / Paste / Autofill.
 * Zeigt Schlüssel nie an — nur stiller Scan und POST an das lokale Gateway.
 */
export function LlmkaruselKeyBridge() {
  onMount(() => {
    void readClipboard()

    const onFocus = () => void readClipboard()
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text") ?? ""
      void postKeys(text)
    }
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null
      if (!target || target.name !== "api_key") return
      void postKeys(target.value)
      target.value = ""
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("paste", onPaste)
    document.addEventListener("input", onInput)
    onCleanup(() => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("input", onInput)
    })
  })

  return (
    <input
      type="password"
      name="api_key"
      autocomplete="current-password"
      tabindex={-1}
      aria-hidden="true"
      style={{
        position: "fixed",
        opacity: "0",
        width: "1px",
        height: "1px",
        "pointer-events": "none",
        left: "-9999px",
      }}
    />
  )
}
