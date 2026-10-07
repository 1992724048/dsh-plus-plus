import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const SESSION_ROUTE = '/api/dsh-plus-plus/sessions'

const SESSION_ID = /^(?:session-)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

export function projectKey(cwd) {
  if (cwd.length === 0) throw new Error('cannot encode an empty project path')
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i += 1) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`
}

export function dshRoot() {
  return path.join(os.homedir(), '.dsh')
}

export function sessionsRoot() {
  return path.join(dshRoot(), 'sessions')
}

export function projcacheDir() {
  return path.join(dshRoot(), 'storages', 'session_projcache', 'sessions')
}

export function findSessionDir(id) {
  const segment = encodeSegment(id)
  const root = sessionsRoot()
  let projects
  try {
    projects = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const candidate = path.join(root, project.name, segment)
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate
    } catch { }
  }
  return undefined
}

export async function deleteSessionFiles(id) {
  if (typeof id !== 'string' || !SESSION_ID.test(id)) {
    const error = new Error('invalid session id')
    error.code = 'BAD_ID'
    throw error
  }

  const dir = findSessionDir(id)
  let deleted = false
  if (dir !== undefined) {
    await fs.promises.rm(dir, { recursive: true, force: true })
    deleted = true
  }

  let cacheRemoved = false
  const cache = path.join(projcacheDir(), `${id}.json`)
  try {
    await fs.promises.rm(cache, { force: true })
    cacheRemoved = true
  } catch {
  }

  return { deleted, alreadyAbsent: !deleted, cacheRemoved }
}

const registrations = new WeakMap()

const REMOVED_EVENT = 'api-session/removed'

function announceRemoved(ctx, id) {
  try {
    ctx.emit(REMOVED_EVENT, id)
  } catch (error) {
    console.warn('dsh-plus-plus: announcing the removed session failed:', error)
  }
}

export function installSessionRoutes({ ctx }) {
  const webServer = ctx.get?.('webServer')
  if (!webServer?.register) return () => {}

  let entry = registrations.get(webServer)
  if (entry === undefined) {
    try {
      entry = {
        holders: 1,
        owned: true,
        dispose: webServer.register({
          kind: 'prefix',
          path: SESSION_ROUTE,
          handler: (req, res) => serve(req, res, id => announceRemoved(ctx, id)),
        }),
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
    && error.message.includes(SESSION_ROUTE)
}

async function serve(req, res, announceRemoved) {
  const method = (req.method ?? 'GET').toUpperCase()
  if (method !== 'DELETE') return respond(res, 405, 'method not allowed')

  const requested = decodePath(req.url ?? '')
  if (requested === undefined) return respond(res, 400, 'bad request')

  const after = requested.startsWith(SESSION_ROUTE)
    ? requested.slice(SESSION_ROUTE.length)
    : requested

  const parts = after.split('/').filter(part => part !== '')
  if (parts.length !== 1) return respond(res, 400, 'bad request')

  let id
  try {
    id = decodeURIComponent(parts[0])
  } catch {
    return respond(res, 400, 'bad request')
  }

  try {
    const result = await deleteSessionFiles(id)
    announceRemoved(id)
    return respond(res, 200, JSON.stringify(result), { 'content-type': 'application/json' })
  } catch (error) {
    if (error?.code === 'BAD_ID') return respond(res, 400, 'invalid session id')
    return respond(res, 500, 'delete failed')
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

function respond(res, status, body, extraHeaders = {}) {
  const payload = Buffer.from(body, 'utf8')
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': payload.length,
    ...extraHeaders,
  })
  res.end(payload)
}
