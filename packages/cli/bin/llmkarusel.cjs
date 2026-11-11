#!/usr/bin/env node
process.env.OPENCODE_CLIENT = process.env.OPENCODE_CLIENT || "llmkarusel"
process.env.OPENCODE_MODEL = process.env.OPENCODE_MODEL || "llmkarusel/auto"
require("./opencode.cjs")
