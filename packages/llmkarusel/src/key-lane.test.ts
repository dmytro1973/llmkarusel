import { expect, test } from "bun:test"
import { scanKeys } from "./key-lane.ts"

const openrouter = "sk-or-v1-" + "a".repeat(64)
const google = "AIza" + "B".repeat(35)
const groq = "gsk_" + "C".repeat(52)
const nvidia = "nvapi-" + "D".repeat(64)

test("matches exact formats in order", () => {
  const text = `noise ${nvidia} ${groq} ${google} ${openrouter} end`
  const routes = scanKeys(text)
  expect(routes.map((r) => r.id)).toEqual(["openrouter", "google", "groq", "nvidia"])
})

test("rejects glued or wrong length keys", () => {
  expect(scanKeys("x" + openrouter)).toEqual([])
  expect(scanKeys(openrouter + "y")).toEqual([])
  expect(scanKeys("sk-or-v1-" + "a".repeat(63))).toEqual([])
  expect(scanKeys("gsk_" + "C".repeat(51))).toEqual([])
  expect(scanKeys("nvapi-" + "D".repeat(63))).toEqual([])
})
