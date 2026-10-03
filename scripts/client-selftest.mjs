/**
 * Client-side self test.
 *
 * The browser half is a set of hand-written ModuleLoader bundles with no test
 * runner and no module graph, so this loads them the way the shell does — one
 * shared `require` that resolves sibling chunks — and asserts what the shell
 * requires of them and what the features promise.
 *
 * The cases are split by concern so a failure names its area and no file grows
 * without bound:
 *
 *   client-tests/harness.mjs   the loader and context stubs, and why they are shaped
 *                              the way they are
 *   client-tests/loader.mjs    the bundle patch, the entry's exports, `require`
 *   client-tests/registry.mjs  core: the feature registry, palette layers, dictionaries
 *   client-tests/features.mjs  one section per feature chunk
 *   client-tests/bundles.mjs   properties of the files themselves, and stub fidelity
 *
 * Run: `node scripts/client-selftest.mjs`
 */

import { run } from './client-tests/harness.mjs'

// Order matters only for readability of the output — the suites are independent.
await import('./client-tests/loader.mjs')
await import('./client-tests/registry.mjs')
await import('./client-tests/features.mjs')
await import('./client-tests/bundles.mjs')

process.exit(await run('client'))
