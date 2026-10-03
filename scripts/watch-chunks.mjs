/**
 * Keep the entry's revision moving when a chunk changes.
 *
 * ## Why this exists
 *
 * The shell derives an entry's revision from the *entry file's* metadata —
 * `framedHash("plugin-artifact", [mtimeMs, ctimeMs, size])` — and resolves a
 * chunk against that revision:
 *
 *     chunkUrl(row, fileName, rev) → <route>/<id>/<fileName>?rev=<entry rev>
 *
 * It never hashes the chunk's own bytes. So editing `client.composer.js` leaves
 * the entry's revision untouched, the browser's cached URL is still considered
 * fresh, and **the change silently does not appear** — no error, no crash, and no
 * amount of restarting helps, because a restart re-derives the same revision from
 * the same unchanged mtime.
 *
 * That is what made several rounds of composer fixes look like they had no effect.
 * The fix is to touch the entry whenever any chunk changes, so its revision moves
 * and the browser reloads the whole graph.
 *
 * ## Usage
 *
 *   node scripts/watch-chunks.mjs          watch until interrupted
 *   node scripts/watch-chunks.mjs --once   touch once if something is stale, then exit
 *
 * The entry's `CHUNKS` list is parsed, so a chunk that is not listed is not
 * watched — adding a file to disk without adding it to the list is a mistake this
 * will not paper over.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY = path.join(ROOT, 'client.js')

/** How often to look for changes. Comfortably slower than the shell's 500ms poll. */
const POLL_MS = 400

/** The chunk specifiers `client.js` requires, in declaration order. */
function listedChunks(source) {
  const block = /const CHUNKS = \[([\s\S]*?)\]/.exec(source)
  if (block === null) throw new Error('could not find CHUNKS in client.js')
  return [...block[1].matchAll(/'([^']+)'/g)]
    .map(m => m[1])
    .filter(name => name.startsWith('./') && name !== './client.js')
    .map(name => name.slice(2))
}

const entryMtime = () => fs.statSync(ENTRY).mtimeMs

/**
 * Bring the entry's mtime past every chunk's, so its revision always wins.
 *
 * Compared with a one-second floor rather than the chunks' own mtimes: file
 * timestamps have coarse granularity on some filesystems, so a chunk written in
 * the same tick as the last touch would otherwise look "not newer".
 */
function touchEntry() {
  const latest = Math.max(entryMtime(), ...listedChunks(fs.readFileSync(ENTRY, 'utf8'))
    .map(file => fs.statSync(path.join(ROOT, file)).mtimeMs))
  const now = Date.now()
  const target = Math.max(now, latest + 1000)
  fs.utimesSync(ENTRY, target / 1000, target / 1000)
  return target
}

/** True when any listed chunk is newer than the entry. */
function staleChunks() {
  const entry = entryMtime()
  return listedChunks(fs.readFileSync(ENTRY, 'utf8'))
    .filter(file => fs.statSync(path.join(ROOT, file)).mtimeMs > entry)
}

const once = process.argv.includes('--once')

if (once) {
  const stale = staleChunks()
  if (stale.length === 0) {
    process.stdout.write('entry is current; nothing to touch\n')
    process.exit(0)
  }
  process.stdout.write(`stale chunks: ${stale.join(', ')}\ntouched client.js\n`)
  touchEntry()
  process.exit(0)
}

process.stdout.write(
  `watching ${listedChunks(fs.readFileSync(ENTRY, 'utf8')).length} chunk(s); `
  + 'client.js is touched when any of them is newer — Ctrl-C to stop\n',
)

const timer = setInterval(() => {
  try {
    const stale = staleChunks()
    if (stale.length === 0) return
    touchEntry()
    process.stdout.write(`client.js touched — newer than: ${stale.join(', ')}\n`)
  } catch (error) {
    // A missing or half-written file during a save is normal; try again next tick.
    process.stderr.write(`watch: ${error.message}\n`)
  }
}, POLL_MS)

// Do not hold the process open for this alone.
timer.unref?.()
process.stdin?.resume()
