/**
 * Lint the host half: the files Node actually loads at runtime.
 *
 * ## Why this exists separately from the CSS literal check
 *
 * The client bundles are checked because a stray backtick breaks them in a way
 * that surfaces far from the cause. The host half fails differently and just as
 * quietly: it is plain ESM, parsed only when something imports it, so a file that
 * nothing currently reaches stays broken until the day it is reached. `node --check`
 * on every file closes that gap.
 *
 * Two checks, both cheap and both about mistakes that survive a parse:
 *
 *  - **`node:` prefix.** The plugin runs on a bundled runtime; a bare `fs` import
 *    resolves differently there than in a plain Node process, which is exactly
 *    where it would be tested.
 *
 * A third check for hand-written Windows path separators was written here and then
 * removed — see {@link checkNodePrefixed}.
 *
 * Run: `node scripts/check-host.mjs`
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Directories holding host-half sources. */
const ROOTS = ['src']

/** Entry files at the top level, which are not in those directories. */
const ENTRIES = ['index.js']

// ── checks ───────────────────────────────────────────────────────────────────

/**
 * Every host source file, sorted.
 *
 * Walked rather than listed so a new directory or file is covered without editing
 * this script — the same reason the client side reads the file system.
 */
export function hostFiles() {
  const files = []
  for (const dir of ROOTS) walk(path.join(ROOT, dir), files)
  for (const name of ENTRIES) {
    const file = path.join(ROOT, name)
    if (fs.existsSync(file)) files.push(file)
  }
  return files.sort()
}

function walk(dir, into) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk(full, into)
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      into.push(full)
    }
  }
}

/**
 * Parse each file.
 *
 * `node --check` rather than anything in-process. It understands the module
 * system the package declares without a flag — `vm.SourceTextModule` does too,
 * but only behind --experimental-vm-modules, which would then have to be threaded
 * through the hook as well. `compileFunction` is not an option: it parses as
 * CommonJS and rejects every import.
 */
function checkParses(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status === 0) return undefined
  const message = (result.stderr ?? '').split('\n').find(line => /SyntaxError|Error/.test(line))
  return `${path.relative(ROOT, file)}  does not parse: ${(message ?? 'unknown error').trim()}`
}

/**
 * A bare `fs`-style import.
 *
 * The plugin runs inside a bundled runtime, where the `node:` prefix is what
 * resolves reliably; a bare specifier can bind to something else entirely there
 * while working perfectly in a plain Node process, which is where it would be
 * tested.
 *
 * A third check — single-backslash path separators — was written here and then
 * removed. It was meant to catch `join(dir + '\' + name)`, but nothing in the host
 * half writes separators by hand; every path goes through `path.join` or
 * `path.resolve`, which is portable. The pattern also had to be careful about
 * ordinary escapes like `\n`, so it was a rule that could misfire to catch a
 * mistake nobody was making.
 */
function checkNodePrefixed(file, source) {
  const hits = []
  const pattern = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'":][^'"]*)['"]/gm
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1]
    if (specifier.startsWith('.')) continue
    if (specifier.startsWith('node:')) continue
    hits.push(`${path.relative(ROOT, file)}  bare import of "${specifier}" — use the node: prefix`)
  }
  return hits
}

// ── entry point ──────────────────────────────────────────────────────────────

/** All problems found; empty means the host half is clean. */
export function check() {
  const problems = []
  let count = 0

  for (const file of hostFiles()) {
    count += 1
    const source = fs.readFileSync(file, 'utf8')

    const parseError = checkParses(file)
    if (parseError !== undefined) problems.push(parseError)

    problems.push(...checkNodePrefixed(file, source))
  }

  if (problems.length === 0) {
    process.stdout.write(`host sources ok — ${count} file(s)\n`)
    return true
  }

  process.stderr.write(`${problems.length} problem(s) in the host half:\n\n`)
  for (const problem of problems) process.stderr.write(`  ${problem}\n`)
  return false
}

const invokedDirectly = process.argv[1] !== undefined
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))

if (invokedDirectly) process.exit(check() ? 0 : 1)
