import { Effect } from "effect"
import { define } from "@opencode/plugin/effect/plugin"

const GATEWAY = "http://127.0.0.1:4127/v1"

/**
 * Keeps the configured llmkarusel provider pointed at the local failover gateway.
 * Respects activation: "disabled". Uses LLMKARUSEL_TOKEN when present.
 */
export const LlmkaruselPlugin = define({
  id: "opencode.provider.llmkarusel",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.provider.transform((evt) => {
      for (const item of evt.list()) {
        if (item.provider.id !== "llmkarusel") continue
        if (item.provider.activation === "disabled") continue
        evt.update(item.provider.id, (provider) => {
          provider.name = provider.name || "llmkarusel"
          provider.package = "@opencode/ai/providers/openai-compatible"
          if (provider.activation === "auto") provider.activation = "enabled"
          const token = process.env.LLMKARUSEL_TOKEN
          provider.settings = {
            ...provider.settings,
            baseURL: typeof provider.settings?.baseURL === "string" ? provider.settings.baseURL : GATEWAY,
            apiKey: token || provider.settings?.apiKey || "llmkarusel-local",
          }
          provider.headers = {
            ...provider.headers,
            "X-Title": "llmkarusel",
          }
        })
      }
    })
  }),
})
