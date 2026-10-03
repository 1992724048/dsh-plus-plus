/**
 * Diagnostic probe: does a second `apply` survive a hot reload?
 *
 * Reproduces `dsh-hmr`'s behaviour against a stub that enforces the host's
 * duplicate-route guard — the guard whose violation produced "duplicate prefix
 * route … did not activate" in the real shell. Run:
 *
 *   node scripts/probe-reload.mjs
 */

import * as plugin from '../index.js'
import { FONT_ROUTE } from '../src/fonts.js'

const routes = []

/** A webServer that throws on a duplicate `(kind, path)`, as the host does. */
const webServer = {
  register(route) {
    if (routes.some(r => r.kind === route.kind && r.path === route.path)) {
      throw new Error(`webserver: duplicate ${route.kind} route "${route.path}" at Proxy.register`)
    }
    routes.push(route)
    return () => {
      const index = routes.indexOf(route)
      if (index >= 0) routes.splice(index, 1)
    }
  },
}

const ctx = { get: name => (name === 'webServer' ? webServer : undefined) }

console.log('route         :', FONT_ROUTE)
console.log('routes at rest:', routes.length)

// First apply: the normal boot path.
const disposeFirst = plugin.apply(ctx)
console.log('after 1st apply:', routes.length, 'route(s)')

// Second apply on the same server: what a hot reload does when the previous
// fiber has not been torn down yet. This used to throw.
let disposeSecond
try {
  disposeSecond = plugin.apply(ctx)
  console.log('after 2nd apply:', routes.length, 'route(s) — no collision')
} catch (error) {
  console.log('SECOND APPLY THREW:', error.message)
  process.exit(1)
}

// The reload goes away first, while the original fiber is still live.
disposeSecond()
console.log('after reload disposed:', routes.length, 'route(s) — the first fiber still holds it')

// Last holder out.
disposeFirst()
console.log('after last disposed :', routes.length, 'route(s) — released')

// And a fresh boot works again afterwards.
const disposeThird = plugin.apply(ctx)
console.log('after 3rd apply     :', routes.length, 'route(s)')
disposeThird()
console.log('final               :', routes.length, 'route(s)')
