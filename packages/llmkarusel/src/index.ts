export { FORMATS, scanKeys, providerLabel, type BoundRoute, type ProviderId } from "./key-lane.ts"
export { KEYLESS, runKarusel, type Attempt, type ChatBody, type KaruselResult, type RunOptions } from "./karusel.ts"
export { readClipboardText, scanClipboard, scanText, type ClipboardScan } from "./clipboard.ts"
export { authorize, ensureToken, readToken, tokenPath } from "./token.ts"

export const GATEWAY_DEFAULT = {
  host: "127.0.0.1",
  port: 4127,
  baseURL: "http://127.0.0.1:4127/v1",
} as const
