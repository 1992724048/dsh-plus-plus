/**
 * Font delivery (Host half).
 *
 * The browser cannot `require()` a woff2, and a ModuleLoader bundle is one
 * function body with no build step — so there is no bundler to hash, inline or
 * base64 these files. The host therefore serves them as static assets and the
 * client half points `@font-face` `src` at the route.
 *
 * Why a route and not a CDN: the whole point of depending on the packages instead
 * of reading system fonts is that the glyphs are guaranteed present. Reading them
 * off the local disk keeps that guarantee while costing one route and zero
 * network egress.
 *
 * One `prefix` route covers every asset: the packages ship hundreds of woff2
 * shards, and registering a route per file would mean hundreds of registrations
 * that all have to be unregistered in step. A single prefix also means the two
 * families can grow without touching this module.
 *
 * @module src/fonts.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Route prefix. Must match `FONT_BASE` in the client half. */
export const FONT_ROUTE = '/api/dsh-plus-plus/fonts'

/** MIME type per file extension. Only woff2 and woff are shipped by these packages. */
const MIME = Object.freeze({
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.css': 'text/css; charset=utf-8',
})

/** Content types that must not be served: the packages' own build scripts. */
const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME))

/**
 * The CSS font stacks this plugin applies, keyed by usage.
 *
 * `mono` covers code and anything laid out on a fixed grid; `sans` is body text.
 * HarmonyOS Sans follows JetBrains Mono in the mono stack because JetBrains Mono
 * has no CJK coverage: the browser resolves the list per character, so a Chinese
 * character inside a code span falls through to it without a second declaration.
 *
 * This is presentation, not routing — the served packages are {@link FAMILIES}.
 */
export const FONT_STACK = Object.freeze({
  mono: ['JetBrains Mono', 'HarmonyOS Sans', 'ui-monospace', 'monospace'],
  sans: ['HarmonyOS Sans', 'system-ui', 'sans-serif'],
})

/**
 * The npm packages that supply the faces, keyed by the URL segment that reaches
 * them. This is the routing table: each key is both the path prefix and the
 * argument to {@link assetRoot}.
 */
export const FAMILIES = Object.freeze(['jetbrains-mono', 'harmonyos-sans-sc'])

/**
 * Resolve the on-disk asset root for one served family.
 *
 * Each root is the directory the package's own stylesheets resolve their `url()`
 * against: `@fontsource/jetbrains-mono` writes `./files/…`, while
 * `harmonyos-sans-webfont-splitted` writes `./Regular/…` relative to its per-weight
 * stylesheet. Serving from each package root means those relative URLs keep
 * working unchanged — the stylesheets are shipped as-is, never rewritten.
 *
 * Returns `undefined` for a family that is not installed, so a missing optional
 * package degrades to "that family is absent" rather than failing the plugin.
 *
 * @param {'jetbrains-mono'|'harmonyos-sans-sc'} family
 * @returns {string | undefined} Absolute directory path.
 */
export function assetRoot(family) {
  try {
    if (family === 'jetbrains-mono') {
      return path.dirname(require.resolve('@fontsource/jetbrains-mono/package.json'))
    }
    if (family === 'harmonyos-sans-sc') {
      // This package declares an `exports` map that does not expose
      // `./package.json`, so `require.resolve('…/package.json')` throws. Its `main`
      // is `dist/HarmonyOS_Sans_SC/index.css`, which sits inside exactly the
      // directory we want to serve — so the root is its direct parent. Guarding on
      // the `.css` suffix keeps a future `main` change from silently serving the
      // wrong tree.
      const entry = require.resolve('harmonyos-sans-webfont-splitted')
      if (!entry.endsWith('.css')) return undefined
      return path.dirname(entry)
    }
  } catch {
    /* the package is not installed */
  }
  return undefined
}

/** URL prefix → package root, for every installed family. */
const ROOTS = new Map()

/**
 * Populate {@link ROOTS} from what is actually installed.
 *
 * Built lazily on first request rather than at module load so an uninstalled
 * package contributes no entry instead of throwing and taking the plugin with it.
 */
function ensureRoots() {
  if (ROOTS.size > 0) return
  for (const family of FAMILIES) {
    const root = assetRoot(family)
    if (root !== undefined) ROOTS.set(`/${family}/`, root)
  }
}

/**
 * Install the font route on a context.
 *
 * @param {object} deps
 * @param {object} deps.ctx Cordis context.
 * @returns {() => void} Disposer.
 */
export function installFontRoutes({ ctx }) {
  const webServer = ctx.get?.('webServer')
  if (!webServer?.register) return () => {}

  const dispose = webServer.register({
    kind: 'prefix',
    path: FONT_ROUTE,
    handler: serve,
  })
  return typeof dispose === 'function' ? dispose : () => {}
}

/**
 * Serve one font asset.
 *
 * Resolves the request path to a file under a known family root and refuses
 * anything that escapes it: the route is same-origin and reachable by anything
 * running on the page, so a traversal here would be a real file-read primitive.
 */
async function serve(req, res) {
  ensureRoots()
  const requested = decodePath(req.url ?? '')
  if (requested === undefined) return respond(res, 400, 'text/plain', 'bad request')

  // This is a `prefix` route, so the handler receives the whole pathname. Strip
  // the route prefix to get the family-relative part the browser asked for.
  const afterRoute = requested.startsWith(FONT_ROUTE)
    ? requested.slice(FONT_ROUTE.length)
    : requested

  const prefix = [...ROOTS.keys()].find(key => afterRoute.startsWith(key))
  if (prefix === undefined) return respond(res, 404, 'text/plain', 'not found')

  const root = ROOTS.get(prefix)
  const relative = afterRoute.slice(prefix.length)
  const extension = path.extname(relative).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(extension)) return respond(res, 403, 'text/plain', 'forbidden')

  // Containment check: the resolved path must stay under the family root, so a
  // traversal in the URL cannot read outside the package.
  const resolved = path.resolve(root, relative)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return respond(res, 403, 'text/plain', 'forbidden')
  }

  try {
    const body = await fs.promises.readFile(resolved)
    respond(res, 200, MIME[extension], body, {
      'cache-control': 'public, max-age=31536000, immutable',
    })
  } catch {
    respond(res, 404, 'text/plain', 'not found')
  }
}

/**
 * Strip the query and hash, and reject a path that tries to escape.
 *
 * A traversal is refused outright rather than normalised: `..` in a font URL is
 * never legitimate, and normalising it would let `%2e%2e` through as a bare
 * segment that later resolves outside the root.
 */
function decodePath(url) {
  const pathname = url.split('?')[0].split('#')[0]
  try {
    const decoded = decodeURIComponent(pathname)
    if (decoded.includes('..') || decoded.includes('\0')) return undefined
    return decoded
  } catch {
    return undefined
  }
}

/** Write one response. */
function respond(res, status, contentType, body, extraHeaders = {}) {
  const payload = typeof body === 'string' ? Buffer.from(body, 'utf8') : body
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': payload?.length ?? 0,
    ...extraHeaders,
  })
  res.end(payload)
}
