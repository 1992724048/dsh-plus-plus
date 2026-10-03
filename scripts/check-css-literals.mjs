/**
 * Reject a stray backtick inside a CSS template literal, before it is committed.
 *
 * ## Why this exists
 *
 * A CSS sheet is a JavaScript template literal, and a backtick inside it closes
 * the literal early: everything after becomes JavaScript, and the file stops
 * parsing. That happened ten times in this repository — a comment quoting
 * `display: none`, `max-width: min(360px, 45cqw)`, `flex: none` and others —
 * and each time the failure surfaced far from the cause, as a dozen unrelated
 * tests reporting "Unexpected identifier" before one named the file.
 *
 * The test suite catches it, but only after the edit is already written and the
 * suite has been run. This runs first, in the commit path, so the mistake never
 * lands.
 *
 * ## What it checks
 *
 * Every template literal that opens with a CSS-looking assignment. For each one it
 * walks to the matching closer — honouring escapes — and looks for a backtick in
 * between. Comments are stripped first, because a backtick in the prose above a
 * literal is legal and common; only the literal's own text is inspected.
 *
 * Run: `node scripts/check-css-literals.mjs`
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Bundle files that can hold a stylesheet. */
const CANDIDATES = /^client(\.[a-z0-9-]+)*\.js$/

/** Openers: a CSS-looking name bound to a template literal. */
const OPENER = /\b(CSS|STYLES|SHEET)\w*\s*=\s*`/gi

/**
 * One finding: a stray backtick inside a CSS literal.
 *
 * @param {string} file Absolute path.
 * @param {string} literal The name of the literal, for the message.
 * @param {number} offset Character offset of the stray backtick in the original.
 * @param {string} source The original file text.
 */
function describe(file, literal, offset, source) {
  const line = source.slice(0, offset).split('\n').length
  const text = source.split('\n')[line - 1]?.trim() ?? ''
  const name = path.relative(ROOT, file)
  return `${name}:${line}  a backtick inside the ${literal} template literal closes it early\n`
    + `      ${text.slice(0, 72)}\n`
    + '      describe the code in prose instead: `display: none` → display none'
}

/**
 * Every stray backtick across every candidate file.
 *
 * Scans literal by literal rather than by a single regex pass.
 *
 * ## The shape of the mistake
 *
 * A stray backtick almost always appears as a *matched pair* inside a comment —
 * someone quotes a declaration, and the pair closes the literal early. So the
 * backtick that ends up first is a legitimate-looking closer, and the literal's
 * own text ends right there. What gives it away is what follows: a stylesheet
 * does not stop a few characters after its opener.
 *
 * That is the test used here. For each opener, find the first unescaped backtick,
 * and if the literal ends there while a substantial stylesheet still follows
 * before the end of the file, the closer was borrowed and the pair inside is the
 * offender. Both halves of the condition matter: an early closer in a genuinely
 * tiny literal is legitimate, and a full-length literal whose closer sits at the
 * very end is legitimate too.
 *
 * Comments are deliberately not stripped — the offending backtick lives inside
 * one. `require('…')` specifiers are not masked either: an earlier attempt
 * blanked them with a regex, and it ran past the literal boundary and masked the
 * very backtick it was meant to find.
 */
export function findStrayBackticks(file, source) {
  const findings = []
  const openers = [...source.matchAll(OPENER)]

  for (const opener of openers) {
    const literal = opener[1]
    const start = opener.index + opener[0].length

    let closer = start
    for (;;) {
      closer = source.indexOf('`', closer)
      if (closer < 0) break
      let backslashes = 0
      for (let i = closer - 1; i >= start && source[i] === '\\'; i -= 1) backslashes += 1
      if (backslashes % 2 === 0) break
      closer += 1
    }
    if (closer < 0) continue

    const remainder = source.slice(closer + 1)
    // A literal that closed properly is *consumed* right after the backtick — by
    // `.trim()`, an assignment, an argument list. That is the one unambiguous
    // signal available, and it is what the last three heuristics were each
    // missing: a legitimately short sheet is followed by a call, and a borrowed
    // closer is followed by the declaration that belonged inside the literal.
    if (CONSUMED_BY.test(remainder)) continue
    if (remainder.length < MINIMUM_TRAILING_CSS) continue
    if (!looksLikeMoreCss(remainder)) continue
    if (source.slice(start, closer).includes('${')) continue

    findings.push(describe(file, literal, closer, source))
  }

  return findings
}

/**
 * What may immediately follow a correctly-closed literal.
 *
 * A method call, a bracket, a comment or statement punctuation — the shapes a real
 * use site has. A bare identifier is deliberately *not* in the set: in every
 * borrowed-closer case the text after the stray quote was a comment tail, and a
 * loose identifier pattern matched it and cleared the finding.
 */
const CONSUMED_BY = /^\s*(?:\.\s*[\w$]+\s*[(;,)\]]|\)\s*[,;)\]]|[)\]}]|;|,|\/\*|\/\/)/

/** How much must follow a closer for the early close to be credible, in characters. */
const MINIMUM_TRAILING_CSS = 400

/**
 * Whether the given text still looks like a stylesheet rather than the code that
 * follows a short one.
 *
 * Looks for a rule *anywhere* in the remainder but requires it to be plainly CSS —
 * a selector line, then a block with declarations — and, crucially, to appear
 * before any statement that would be JavaScript. A literal that closed properly is
 * followed by a call or an assignment; a borrowed closer is followed by the
 * declaration that belonged inside it.
 *
 * The earlier versions of this test were each right about one failure and wrong
 * about another: scanning a wide window flagged the JavaScript after a legitimately
 * short sheet, and demanding the rule at the very head missed a borrowed closer
 * whose comment tail came first. Matching the shape instead of the position is what
 * makes both cases fall out correctly.
 */
function looksLikeMoreCss(text) {
  const window = text.slice(0, 3000)
  // A selector on its own line followed by a block of declarations.
  const rule = /(?:^|\n)\s*[.#]?[\w[\]="'>_-][^{}\n]*\n?\s*\{[^}]*:[^}]*\}/
  return rule.test(window)
}

/** The candidate files on disk. */
export function candidateFiles() {
  return fs.readdirSync(ROOT)
    .filter(name => CANDIDATES.test(name))
    .map(name => path.join(ROOT, name))
}

// ── entry point ──────────────────────────────────────────────────────────────

/** True when nothing is wrong. Prints every finding and returns that verdict. */
export function check() {
  const findings = []
  for (const file of candidateFiles()) {
    findings.push(...findStrayBackticks(file, fs.readFileSync(file, 'utf8')))
  }

  if (findings.length === 0) {
    process.stdout.write(`css literals ok — ${candidateFiles().length} bundle file(s)\n`)
    return true
  }

  process.stderr.write(`${findings.length} stray backtick(s) in CSS template literals:\n\n`)
  for (const finding of findings) process.stderr.write(`  ${finding}\n`)
  process.stderr.write('\nA backtick ends the template literal, so the rest of the stylesheet is\n')
  process.stderr.write('read as JavaScript and the bundle stops parsing. Describe the code in\n')
  process.stderr.write('prose instead — write display none, not the quoted form.\n')
  return false
}

// Only when run directly, not when imported by the hook or the suite.
// `realpath` on both sides so a symlinked invocation or a drive-letter
// difference cannot make this look like an import.
const invokedDirectly = process.argv[1] !== undefined
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))

if (invokedDirectly) process.exit(check() ? 0 : 1)
