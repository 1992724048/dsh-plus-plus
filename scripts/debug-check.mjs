/** Throwaway: does the checker catch a realistic borrowed closer? */

import fs from 'node:fs'
import { findStrayBackticks } from './check-css-literals.mjs'

const TICK = String.fromCharCode(96)
const clean = fs.readFileSync('./client.shape.js', 'utf8')

console.log('clean ->', findStrayBackticks('client.shape.js', clean).length, 'findings')

const marker = 'const CSS = ' + TICK
const at = clean.indexOf(marker) + marker.length

// Each of these happened for real in this repository.
const cases = {
  'paired quotes in a comment': '/* host sets ' + TICK + 'display: none' + TICK + ' here */',
  'single quote mid-comment': '/* host sets ' + TICK + 'display: none here */',
  'quotes a selector': '/* the host uses ' + TICK + 'corner-shape: round' + TICK + ' */',
}

for (const [label, inserted] of Object.entries(cases)) {
  const broken = clean.slice(0, at) + inserted + clean.slice(at)
  const found = findStrayBackticks('client.shape.js', broken)
  console.log(`${label} -> ${found.length} finding(s)`)
  if (found.length > 0) console.log('   ', found[0].split('\n')[0])
}

// And a sheet that legitimately ends early must not be flagged: a real CSS file
// whose last rule is short still has hundreds of characters before the closer.
console.log('legit short tail ->', (() => {
  const tiny = 'const CSS = `a { b: c }`\nconst x = 1\n'
  return findStrayBackticks('tiny.js', tiny).length
})(), 'findings')
