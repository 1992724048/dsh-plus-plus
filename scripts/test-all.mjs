/**
 * Run every check in order.
 *
 * Sequential and fail-fast, so the first failure is the one the user sees.
 *
 * Run: `node scripts/test-all.mjs`
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const STEPS = [
  // First, because it is the cheapest and the mistake it catches is the one that
  // turns every later step into a syntax error.
  ['css literal check', 'check-css-literals.mjs'],
  ['host selftest', 'host-selftest.mjs'],
  ['client selftest', 'client-selftest.mjs'],
]

for (const [label, script] of STEPS) {
  const url = new URL(`./${script}`, import.meta.url)
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, [fileURLToPath(url)], { stdio: 'inherit' })
    child.on('close', resolve)
  })
  if (code !== 0) {
    process.stdout.write(`\n${label} failed (exit ${code})\n`)
    process.exit(code ?? 1)
  }
}

process.stdout.write('\nall checks passed\n')
