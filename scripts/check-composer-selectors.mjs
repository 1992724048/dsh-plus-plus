/**
 * Check the composer selectors against a real DOM captured from the shell.
 *
 * The host's class names are build-scoped hashes, so a selector written against
 * them silently stops matching on the next release. This loads the composer chunk's
 * stylesheet and runs every selector over a saved copy of the live DOM, reporting
 * which ones match and — more usefully — which match nothing.
 *
 * Paste a fresh `<div class="RlGAzG_root">…</div>` sample into `composer-dom.html`
 * to re-check after a shell update.
 *
 * Run: `node scripts/check-composer-selectors.mjs`
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SAMPLE = path.join(ROOT, 'composer-dom.html')

if (!fs.existsSync(SAMPLE)) {
  process.stdout.write(`no sample at ${path.relative(ROOT, SAMPLE)}\n`)
  process.stdout.write('save the composer subtree from DevTools there to check the selectors.\n')
  process.exit(0)
}

const html = fs.readFileSync(SAMPLE, 'utf8')

/** The composer chunk's stylesheet, read straight out of the source. */
const source = fs.readFileSync(path.join(ROOT, 'client.composer.js'), 'utf8')
const raw = /const CSS = `([\s\S]*?)`\.trim\(\)/.exec(source)?.[1]
assert.ok(raw, 'could not extract the composer stylesheet')

// Strip comments before parsing. Without this the checker reads prose in a
// comment — "`aria-label="发送消息"` is localised" — as a selector and reports it
// as unmatched, which is noise rather than a finding.
const css = raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * Evaluate a selector against the sample.
 *
 * No DOM library is available, so this matches on the sample's own structure: a
 * selector is judged "used" when one of its attribute or class parts appears on a
 * real tag. That is a structural approximation, not a real CSS engine — enough to
 * catch a selector naming something the DOM does not have, which is the failure
 * that matters here.
 */
function selectorParts(selector) {
  return [...selector.matchAll(/\[([\w-]+)(?:[~|^$*]?="([^"]*)")?\]|\.([\w-]+)/g)].map(m => {
    if (m[1] !== undefined) return { kind: 'attr', name: m[1], value: m[2] }
    return { kind: 'class', name: m[3] }
  })
}

const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
const present = new Set()
for (const match of html.matchAll(/([\w-]+)=(?:"([^"]*)"|([^\s>]+))/g)) present.add(`[${match[1]}]`)
for (const match of html.matchAll(/class="([^"]*)"/g)) {
  for (const cls of match[1].split(/\s+/)) present.add(`.${cls}`)
}

let checked = 0
const unmatched = []

for (const [, selector, body] of rules) {
  for (const part of selector.split(',').map(s => s.trim()).filter(Boolean)) {
    const parts = selectorParts(part)
    if (parts.length === 0) continue
    checked += 1
    // A selector is satisfied when every attribute/class token it names is present
    // somewhere in the sample. Combinators are ignored — this cannot verify that
    // the *structure* matches, only that the tokens do.
    const missing = parts.filter(p => !present.has(p.kind === 'attr' ? `[${p.name}]` : `.${p.name}`))
    if (missing.length > 0) {
      unmatched.push({
        selector: part,
        missing: missing.map(p => p.kind === 'attr' ? `[${p.name}]` : `.${p.name}`),
        body: body.trim().slice(0, 60),
      })
    }
  }
}

process.stdout.write(`${checked} selector tokens checked against ${path.basename(SAMPLE)}\n`)
if (unmatched.length === 0) {
  process.stdout.write('every selector names something the sample actually has\n')
  process.exit(0)
}

process.stdout.write(`\n${unmatched.length} selector(s) name tokens absent from the sample:\n`)
for (const entry of unmatched) {
  process.stdout.write(`  ${entry.selector}\n`)
  process.stdout.write(`    missing: ${entry.missing.join(' ')}\n`)
  process.stdout.write(`    declares: ${entry.body}\n`)
}
process.stdout.write('\nTokens absent from a sample are not necessarily wrong — the sample may be\n')
process.stdout.write('partial. Check each against the live page before changing the stylesheet.\n')
process.exit(0)
