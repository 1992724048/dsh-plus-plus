import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ASSET_ROUTE = '/api/dsh-plus-plus/assets'

const MIME = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
})

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'imgs')

const registrations = new WeakMap()

export function installAssetRoutes({ ctx }) {
  const webServer = ctx.get?.('webServer')
  if (!webServer?.register) return () => {}

  let entry = registrations.get(webServer)
  if (entry === undefined) {
    try {
      entry = {
        holders: 1,
        owned: true,
        dispose: webServer.register({ kind: 'prefix', path: ASSET_ROUTE, handler: serve }),
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
    && error.message.includes(ASSET_ROUTE)
}

async function serve(req, res) {
  const method = (req.method ?? 'GET').toUpperCase()
  if (method !== 'GET') return respond(res, 405, 'text/plain', 'method not allowed')

  const requested = decodePath(req.url ?? '')
  if (requested === undefined) return respond(res, 400, 'text/plain', 'bad request')

  const afterRoute = requested.startsWith(ASSET_ROUTE)
    ? requested.slice(ASSET_ROUTE.length)
    : requested
  const name = afterRoute.startsWith('/') ? afterRoute.slice(1) : afterRoute
  if (name === '' || name.includes('/') || name.includes('\\')) return respond(res, 400, 'text/plain', 'bad request')

  const type = MIME[path.extname(name).toLowerCase()]
  if (type === undefined) return respond(res, 403, 'text/plain', 'forbidden')

  try {
    const body = await fs.promises.readFile(path.join(ROOT, name))
    respond(res, 200, type, body, { 'cache-control': 'no-store' })
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
