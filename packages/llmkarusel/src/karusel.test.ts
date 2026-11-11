import { expect, test } from "bun:test"
import { runKarusel } from "./karusel.ts"

test("fails closed without keys when keyless is false", async () => {
  const result = await runKarusel({
    keys: [],
    keyless: false,
    body: { messages: [{ role: "user", content: "hi" }] },
    timeoutMs: 1000,
  })
  expect(result.ok).toBe(false)
  expect(result.attempts).toEqual([])
})
