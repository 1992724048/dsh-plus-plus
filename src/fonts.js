import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const FONT_ROUTE = '/api/dsh-plus-plus/fonts'

const MIME = Object.freeze({
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.css': 'text/css; charset=utf-8',
})

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME))

export const FONT_STACK = Object.freeze({
  mono: ['JetBrains Mono', 'HarmonyOS Sans', 'ui-monospace', 'monospace'],
  sans: ['HarmonyOS Sans', 'system-ui', 'sans-serif'],
})

export const FAMILIES = Object.freeze(['jetbrains-mono', 'harmonyos-sans-sc'])

export function assetRoot(family) {
  try {
    if (family === 'jetbrains-mono') {
      return path.dirname(require.resolve('@fontsource/jetbrains-mono/package.json'))
    }
    if (family === 'harmonyos-sans-sc') {
      const entry = require.resolve('harmonyos-sans-webfont-splitted')
      if (!entry.endsWith('.css')) return undefined
      return path.dirname(entry)
    }
  } catch {
  }
  return undefined
}

const ROOTS = new Map()

function ensureRoots() {
  if (ROOTS.size > 0) return
  for (const family of FAMILIES) {
    const root = assetRoot(family)
    if (root !== undefined) ROOTS.set(`/${family}/`, root)
  }
}

const registrations = new WeakMap()

export function installFontRoutes({ ctx }) {
  const webServer = ctx.get?.('webServer')
  if (!webServer?.register) return () => {}

  let entry = registrations.get(webServer)
  if (entry === undefined) {
    try {
      entry = {
        holders: 1,
        owned: true,
        dispose: webServer.register({ kind: 'prefix', path: FONT_ROUTE, handler: serve }),
      }
    } catch (error) {
      if (!isDuplicateRoute(error)) throw error
      entry = { holders: 1, owned: false, dispose: ADOPTED }
    }
    registrations.set(webServer, entry)
  } else {
    entry.holders += 1
  }

  let released = false
  return () => {
    if (released) return
    released = true
    const current = registrations.get(webServer)
    if (current !== entry) return
    entry.holders -= 1
    if (entry.holders > 0) return
    registrations.delete(webServer)
    if (entry.owned && typeof entry.dispose === 'function') entry.dispose()
  }
}

const ADOPTED = () => {}

function isDuplicateRoute(error) {
  return typeof error?.message === 'string'
    && error.message.includes('duplicate')
    && error.message.includes(FONT_ROUTE)
}

async function serve(req, res) {
  ensureRoots()
  const requested = decodePath(req.url ?? '')
  if (requested === undefined) return respond(res, 400, 'text/plain', 'bad request')

  const afterRoute = requested.startsWith(FONT_ROUTE)
    ? requested.slice(FONT_ROUTE.length)
    : requested

  const prefix = [...ROOTS.keys()].find(key => afterRoute.startsWith(key))
  if (prefix === undefined) return respond(res, 404, 'text/plain', 'not found')

  const root = ROOTS.get(prefix)
  const relative = afterRoute.slice(prefix.length)
  const extension = path.extname(relative).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(extension)) return respond(res, 403, 'text/plain', 'forbidden')

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

function respond(res, status, contentType, body, extraHeaders = {}) {
  const payload = typeof body === 'string' ? Buffer.from(body, 'utf8') : body
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': payload?.length ?? 0,
    ...extraHeaders,
  })
  res.end(payload)
}
