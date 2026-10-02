/**
 * Prove the junction wiring actually works from the profile's point of view.
 *
 * Resolves the font packages using a require rooted at the *profile* copy of the
 * plugin, not at the repository. That is the only vantage point that matters: the
 * shell resolves the plugin through the profile's node_modules, so this is what
 * decides whether `require.resolve` finds the packages or throws.
 *
 * Diagnostic probe, not a test. Run:
 *
 *   node scripts/probe-install.mjs
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const PROFILE_PLUGIN = 'C:\\Users\\A1992\\.dsh\\profiles\\desktop\\node_modules\\dsh-plus-plus'
const REPO = new URL('..', import.meta.url).pathname.replace(/^\//, '').replace(/\/$/, '')

console.log('repo   :', REPO)
console.log('profile:', PROFILE_PLUGIN)

// A require rooted inside the profile copy, exactly where the shell would load from.
const fromProfile = createRequire(path.join(PROFILE_PLUGIN, 'index.js'))
const fromRepo = createRequire(path.join(REPO, 'index.js'))

let failures = 0
for (const pkg of ['@fontsource/jetbrains-mono/package.json', 'harmonyos-sans-webfont-splitted']) {
  for (const [label, req] of [['profile', fromProfile], ['repo   ', fromRepo]]) {
    try {
      const resolved = req.resolve(pkg)
      console.log(`  ok   ${label} ${pkg}\n         -> ${resolved}`)
    } catch (error) {
      failures += 1
      console.log(`  FAIL ${label} ${pkg}\n         ${error.code ?? error.message}`)
    }
  }
}

// Load the plugin's own font module from the profile vantage point and ask it for
// the roots — this is the code path the Host half actually takes at boot.
console.log('\nloading src/fonts.js through the profile copy…')
try {
  const fonts = await import(`file://${path.join(PROFILE_PLUGIN, 'src', 'fonts.js').replace(/\\/g, '/')}?probe=${Date.now()}`)
  for (const family of ['jetbrains-mono', 'harmonyos-sans-sc']) {
    const root = fonts.assetRoot(family)
    const files = root ? fs.readdirSync(root).length : 0
    console.log(`  ${root ? 'ok  ' : 'FAIL'} ${family} -> ${root ?? 'undefined'} (${files} entries)`)
    if (root === undefined) failures += 1
  }
} catch (error) {
  failures += 1
  console.log('  FAIL import:', error.message)
}

console.log(failures === 0 ? '\njunction wiring ok' : `\n${failures} problem(s)`)
process.exit(failures === 0 ? 0 : 1)
