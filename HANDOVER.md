# Handover: llmkarusel

Stand: 11. November 2026. **Echter OpenCode-Fork**: GitHub `dmytro1973/llmkarusel` (fork von `anomalyco/opencode`), lokal `C:\Users\dmytr\llmkarusel`. Upstream-Remote ohne Push.

## Was das ist

Dieselbe OpenCode-App (CLI/Server/Web/TUI), nicht eine Demo daneben. Provider `llmkarusel/auto` ist eingebaut; das Failover-Gateway startet mit dem Server. Nur freie Remote-Routen. OpenCode Zen ist per Policy verweigert.

- Schlüssel: Format-Scan aus Zwischenablage / Paste / Autofill. Nie anzeigen, kein Passwort-Prompt.
- Failover: echter `fetch` zur nächsten Route bei Verbindungsfehler, Timeout, 402/429/4xx/5xx.
- Shared Kern: `packages/llmkarusel` (key-lane, karusel, gateway auf `127.0.0.1:4127`).
- Gateway: Bearer `LLMKARUSEL_TOKEN`, kein CORS `*`, Loopback-only (sonst `LLMKARUSEL_INSECURE_BIND=1`).
- Keyless nur mit `LLMKARUSEL_KEYLESS=1` (Embed setzt das für den Fork-Default).
- Web-Keys: same-origin `POST /_llmkarusel/keys` (Server forwarded mit Token).

## Lokal starten

```bash
cd C:\Users\dmytr\llmkarusel
bun install
bun run dev              # echter OpenCode-CLI; Gateway startet im Server-Prozess
# branded:
bun packages/cli/bin/llmkarusel.cjs
```

Remote: `origin` = https://github.com/dmytro1973/llmkarusel · `upstream` = anomalyco/opencode  

Web: `bun run dev:web` (Clipboard-Bridge postet erkannte Keys an das Gateway).

## Dateien, die zählen

| Pfad | Rolle |
|---|---|
| `packages/llmkarusel/src/key-lane.ts` | Formate, Zuordnung, Bindung |
| `packages/llmkarusel/src/karusel.ts` | Failover-Kette |
| `packages/llmkarusel/src/gateway.ts` | OpenAI-kompatibles Lokal-Gateway |
| `packages/llmkarusel/src/clipboard.ts` | CLI-Zwischenablage |
| `packages/app/src/runtime/llmkarusel-keys.tsx` | Web Clipboard/Paste/Autofill |
| `packages/core/src/plugin/provider/llmkarusel.ts` | Provider-Plugin |
| `opencode.jsonc` | Default `llmkarusel/auto`, Zen deny |

## Schlüssel → API

| Anbieter | Muster | Endpunkt | Modell |
|---|---|---|---|
| OpenRouter | `sk-or-v1-` + 64 hex | openrouter.ai/.../chat/completions | `openrouter/free` |
| Google | `AIza` + 35 | generativelanguage.../chat/completions | `gemini-2.5-flash` |
| Groq | `gsk_` + 52 | api.groq.com/.../chat/completions | `openai/gpt-oss-20b` |
| NVIDIA | `nvapi-` + 64 | integrate.api.nvidia.com/... | `meta/llama-3.1-8b-instruct` |

Danach keyless: keylessai → pollinations/gpt-oss-20b → pollinations/openai.

## Offen

1. NVIDIA-Länge 64 ist Scanner-Annahme — bei abweichenden echten Keys nur das Muster anpassen.
2. Modell-IDs können 404 liefern — Muster behalten, ID tauschen; immer weiterfallen.
3. Optional: öffentlicher Free-Modell-Katalog-Scan.
4. Branding (Papier-dunkel) in der gesamten OpenCode-UI vertiefen.

## Nicht tun

- Kein Passwort entgegennehmen.
- Keinen Gmail-Zugriff für Keys.
- Schlüssel nicht committen oder loggen.
- Zen nicht als freie Route behandeln.
