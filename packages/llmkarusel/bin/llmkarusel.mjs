#!/usr/bin/env node
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const bun = process.env.BUN_BIN || "bun"
const gatewayEntry = path.join(root, "packages/llmkarusel/src/gateway.ts")
const cliEntry = path.join(root, "packages/cli/src/index.ts")

const gateway = spawn(bun, ["run", gatewayEntry], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
  env: process.env,
  windowsHide: true,
})

const shutdown = () => {
  if (!gateway.killed) gateway.kill()
}

process.on("exit", shutdown)
process.on("SIGINT", () => {
  shutdown()
  process.exit(130)
})
process.on("SIGTERM", () => {
  shutdown()
  process.exit(143)
})

await new Promise((resolve) => setTimeout(resolve, 400))

const child = spawn(bun, ["run", cliEntry, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    OPENCODE_MODEL: process.env.OPENCODE_MODEL || "llmkarusel/auto",
  },
  windowsHide: true,
})

child.on("exit", (code, signal) => {
  shutdown()
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
