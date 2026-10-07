/**
 * Host-side self test.
 *
 * Boots the plugin against a stub `webServer` and drives the font route the way a
 * browser would: real URL, no server-supplied match. Covers the asset serving, the
 * MIME and cache headers, the relative-URL resolution the packages rely on, the
 * traversal guard, and teardown.
 *
 * Run: `node scripts/host-selftest.mjs`
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import * as plugin from '../index.js'
import { FONT_ROUTE, assetRoot } from '../src/fonts.js'
import { SESSION_ROUTE, encodeSegment, projectKey } from '../src/sessions.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

/**
 * A stub `webServer` that records the route the plugin registers.
 *
 * `strict` reproduces the host's duplicate guard: `register` throws when a
 * `(kind, path)` pair is already taken, because route patterns are a
 * composition-level contract. `shared` lets a second stub stand in for a reloaded
 * module instance talking to the same server.
 */
function createStub({ shared, strict, webServerReady = true } = {}) {
  const routes = shared ?? []
  const events = []
  const injections = []
  // The service object is created once and handed out on every `get`. Returning a
  // fresh object each call would make every `apply` see a different server, which
  // is not how a Cordis service behaves — and it would hide exactly the
  // per-server registration reuse this stub exists to exercise.
  const webServer = {
    register: route => {
      if (strict === true && routes.some(r => r.kind === route.kind && r.path === route.path)) {
        throw new Error(
          `webserver: duplicate ${route.kind} route "${route.path}" at Proxy.register`,
        )
      }
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }
  const ctx = {
    routes,
    events,
    webServer,
    get(name) {
      return name === 'webServer' && webServerReady ? webServer : undefined
    },
    emit(...args) {
      events.push(args)
    },
    inject(names, callback) {
      const pending = { names, callback, release: undefined, disposed: false }
      injections.push(pending)
      flush()
      return {
        dispose() {
          if (pending.disposed) return
          pending.disposed = true
          const index = injections.indexOf(pending)
          if (index >= 0) injections.splice(index, 1)
          pending.release?.()
        },
      }
    },
  }
  function flush() {
    for (const pending of [...injections]) {
      if (pending.disposed || !pending.names.every(name => ctx.get(name) !== undefined)) continue
      injections.splice(injections.indexOf(pending), 1)
      pending.release = pending.callback(ctx) ?? undefined
    }
  }
  ctx.startWebServer = () => {
    webServerReady = true
    flush()
  }
  return ctx
}

/** The route serving `path`, whichever order it was registered in. */
function routeFor(ctx, path) {
  return ctx.routes.find(route => route.path === path)
}

/** Drive a registered route and capture the response. */
async function call(ctx, path, url, method = 'GET') {
  const route = routeFor(ctx, path)
  assert.ok(route, `the ${path} route must be registered`)
  let status
  let headers
  const chunks = []
  const res = {
    writeHead(code, head) { status = code; headers = head },
    end(body) { if (body !== undefined) chunks.push(body) },
  }
  await route.handler({ url, method, headers: {} }, res)
  return { status, headers, body: Buffer.concat(chunks) }
}

/** Drive the registered font route and capture the response. */
async function request(ctx, url) {
  return call(ctx, FONT_ROUTE, url, 'GET')
}

/** Every woff2 file starts with the ASCII tag `wOF2`. */
function assertWoff2(body, label) {
  assert.equal(body.subarray(0, 4).toString('latin1'), 'wOF2', `${label} must be a real woff2`)
}

// ── tests ────────────────────────────────────────────────────────────────────

test('plugin entry declares its identity and takes no hard dependency', () => {
  assert.equal(plugin.name, 'plus-plus')
  assert.deepEqual(plugin.inject, [], 'inject must stay empty: a named service would hold the fiber PENDING')
})

test('registers one prefix route per feature and tears them all down', () => {
  // One route per feature, so the count is now two: the font assets and the session
  // delete endpoint. Asserted by path rather than by index or total, so adding a
  // feature later cannot silently satisfy or break this.
  const ctx = createStub()
  const dispose = plugin.apply(ctx)

  for (const path of [FONT_ROUTE, SESSION_ROUTE]) {
    const route = routeFor(ctx, path)
    assert.ok(route, `${path} must be registered`)
    assert.equal(route.kind, 'prefix')
  }
  assert.equal(ctx.routes.length, 2, 'exactly one route per feature, and no others')

  dispose()
  assert.equal(ctx.routes.length, 0, 'every route must be removed on teardown')
})

test('the routes install when the webServer service appears, not only at apply time', () => {
  const ctx = createStub({ webServerReady: false })
  plugin.apply(ctx)
  assert.equal(ctx.routes.length, 0,
    'nothing may register before the service exists')

  ctx.startWebServer()
  assert.deepEqual(ctx.routes.map(route => route.path).sort(), [FONT_ROUTE, SESSION_ROUTE].sort(),
    'the loader starts rows concurrently, so apply runs while webServer is still coming up — a one-shot get there registers nothing and the browser DELETE falls through to the /api channel as "not found"')
})

test('both font packages resolve to an asset root', () => {
  assert.ok(assetRoot('jetbrains-mono'), '@fontsource/jetbrains-mono must resolve')
  assert.ok(assetRoot('harmonyos-sans-sc'), 'harmonyos-sans-webfont-splitted must resolve')
  assert.equal(assetRoot('not-installed'), undefined, 'an unknown family must answer undefined')
})

test('serves a JetBrains Mono shard with the right content type', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  const { status, headers, body } = await request(
    ctx,
    `${FONT_ROUTE}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`,
  )
  assert.equal(status, 200)
  assert.equal(headers['content-type'], 'font/woff2')
  assert.match(headers['cache-control'], /immutable/, 'the assets must be cacheable')
  assert.ok(body.length > 0, 'the shard must have content')
  assertWoff2(body, 'latin-400')
})

test('serves a HarmonyOS stylesheet with its unicode-range intact', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  const { status, headers, body } = await request(ctx, `${FONT_ROUTE}/harmonyos-sans-sc/Regular.css`)
  assert.equal(status, 200)
  assert.match(headers['content-type'], /text\/css/)
  const text = body.toString('utf8')
  assert.match(text, /@font-face/, 'the package stylesheet must reach the browser intact')
  assert.match(text, /unicode-range/, 'its unicode-range shards must survive')
})

test('a relative url inside a served stylesheet resolves to a served shard', async () => {
  // This is the contract that makes the whole design work: each package is served
  // from its own root, so the `url()` its own stylesheets already contain keep
  // resolving. If the roots ever move, these two tests fail.
  for (const [family, stylesheet, pattern] of [
    ['jetbrains-mono', 'latin-400.css', /url\((\.\/files\/[^)]+\.woff2)\)/],
    ['harmonyos-sans-sc', 'Regular.css', /url\("(\.\/Regular\/[^"]+\.woff2)"\)/],
  ]) {
    const ctx = createStub()
    plugin.apply(ctx)
    const css = await request(ctx, `${FONT_ROUTE}/${family}/${stylesheet}`)
    assert.equal(css.status, 200, `${stylesheet} must be served`)
    const href = pattern.exec(css.body.toString('utf8'))?.[1]
    assert.ok(href, `${stylesheet} must reference a shard`)
    const shard = await request(ctx, `${FONT_ROUTE}/${family}/${href.replace(/^\.\//, '')}`)
    assert.equal(shard.status, 200, `${href} must resolve over the same route`)
    assertWoff2(shard.body, href)
  }
})

test('refuses path traversal out of the package root', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  for (const url of [
    `${FONT_ROUTE}/jetbrains-mono/../../../package.json`,
    `${FONT_ROUTE}/jetbrains-mono/%2e%2e/%2e%2e/package.json`,
    `${FONT_ROUTE}/harmonyos-sans-sc/../../package.json`,
    // Encoded slash, which must not survive into a usable path either.
    `${FONT_ROUTE}/jetbrains-mono/..%2f..%2fpackage.json`,
  ]) {
    const { status } = await request(ctx, url)
    assert.ok(status === 400 || status === 403 || status === 404, `${url} must not be served (got ${status})`)
  }
})

test('refuses a non-font extension, an unknown family and a missing file', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  assert.equal((await request(ctx, `${FONT_ROUTE}/jetbrains-mono/package.json`)).status, 403)
  assert.equal((await request(ctx, `${FONT_ROUTE}/nope/x.woff2`)).status, 404)
  assert.equal((await request(ctx, `${FONT_ROUTE}/jetbrains-mono/missing.woff2`)).status, 404)
})

test('ignores the query string', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  const { status } = await request(ctx, `${FONT_ROUTE}/jetbrains-mono/latin-400.css?v=123`)
  assert.equal(status, 200)
})

test('applying twice does not collide — the hot-reload case', () => {
  // The regression that shipped: `webServer.register` throws on a duplicate
  // (kind, path), so a non-idempotent `apply` fails the entry whenever `dsh-hmr`
  // re-applies the plugin — which it does on every save to a watched file. The
  // symptom was "duplicate prefix route … /api/dsh-plus-plus/fonts … did not
  // activate".
  //
  // Two cases, because there are two ways to be called twice: the same module
  // instance applied again, and a *fresh* instance (a real hot reload) applied
  // against a server that already owns the route.
  const first = createStub()
  const ALL = [FONT_ROUTE, SESSION_ROUTE]
  const count = () => ALL.filter(path => routeFor(first, path) !== undefined).length

  const disposeA = plugin.apply(first, {})
  assert.equal(count(), ALL.length, 'both routes register on the first apply')

  // Same instance, applied again: no second registration, and the second holder
  // releasing must not pull the routes out from under the first.
  const disposeAgain = plugin.apply(first, {})
  assert.equal(count(), ALL.length, 'a second apply must not register the routes again')
  disposeAgain()
  assert.equal(count(), ALL.length, 'one holder remains, so the routes must survive')

  // A fresh instance — the reloaded module — against a strict server that already
  // owns the path. It must adopt the existing route rather than throw.
  const reloaded = createStub({ shared: first.routes, strict: true })
  let disposeB
  assert.doesNotThrow(() => { disposeB = plugin.apply(reloaded, {}) },
    'a reloaded instance must not fail on the duplicate-route guard')
  assert.equal(count(), ALL.length, 'the existing routes are reused, not duplicated')

  // The reload goes away while the original fiber is still live: the routes stay.
  disposeB()
  assert.equal(count(), ALL.length, 'the reload leaving must not remove routes the first fiber still holds')

  // Last holder out closes them.
  disposeA()
  assert.equal(first.routes.length, 0, 'the routes are released when the last holder disposes')
  assert.doesNotThrow(() => disposeA(), 'disposing twice must not throw')
})

test('an unrelated registration failure still propagates', () => {
  // The adoption path must only swallow *this route's* duplicate. A server that
  // fails for another reason must still surface it, or a real misconfiguration
  // would hide behind a silently shared route.
  const ctx = createStub()
  ctx.get = name => (name === 'webServer'
    ? { register: () => { throw new Error('webserver: port already in use') } }
    : undefined)
  assert.throws(() => plugin.apply(ctx, {}), /port already in use/,
    'an unrelated registration failure must not be swallowed')
})


// ── session deletion ──────────────────────────────────────────────────────────

test('the delete endpoint refuses anything but a well-formed session id', async () => {
  // This route is same-origin and reachable by anything running on the page, so the
  // id is the only thing standing between a request and a recursive delete. Every
  // case here must be rejected before it reaches a path join.
  const ctx = createStub()
  plugin.apply(ctx)

  const refused = [
    '..',
    '%2e%2e%2f%2e%2e%2fpackage.json',
    'session-../../evil',
    'not-a-uuid',
    'session-3e0f1723',              // too short to be an id
    'a'.repeat(400),                  // long enough to overflow a path segment
    'session-3e0f1723-35cd-40c0-b17a-7f300dd85591/extra',  // more than one segment
    '%00',
  ]
  for (const id of refused) {
    const { status } = await call(ctx, SESSION_ROUTE, `${SESSION_ROUTE}/${id}`, 'DELETE')
    assert.ok(status === 400 || status === 403,
      `${id} must be refused (got ${status})`)
  }

  // A read verb is not a delete; answering 405 rather than 404 keeps a mistaken
  // GET from reading as a missing route.
  assert.equal((await call(ctx, SESSION_ROUTE, `${SESSION_ROUTE}/session-3e0f1723-35cd-40c0-b17a-7f300dd85591`, 'GET')).status, 405)
})

test('deleting an unknown session is a settled no-op, not an error', async () => {
  // Idempotence is what makes a retry safe: if the first attempt removed the
  // directory and then failed to answer, the browser's retry must settle rather
  // than surface a failure for work that is already done.
  const ctx = createStub()
  plugin.apply(ctx)

  const id = 'session-00000000-0000-4000-8000-000000000000'
  const res = await call(ctx, SESSION_ROUTE, `${SESSION_ROUTE}/${id}`, 'DELETE')
  assert.equal(res.status, 200)
  const body = JSON.parse(res.body.toString('utf8'))
  assert.equal(body.deleted, false)
  assert.equal(body.alreadyAbsent, true)
})

test('a settled delete announces the session removal so every client drops its row', async () => {
  const ctx = createStub()
  plugin.apply(ctx)

  const id = 'session-00000000-0000-4000-8000-000000000000'
  const res = await call(ctx, SESSION_ROUTE, `${SESSION_ROUTE}/${id}`, 'DELETE')
  assert.equal(res.status, 200)
  assert.deepEqual(ctx.events, [['api-session/removed', id]],
    'clients only drop a row when the host announces it — the files alone leave the sidebar stale until restart')

  ctx.events.length = 0
  const refused = await call(ctx, SESSION_ROUTE, `${SESSION_ROUTE}/not-a-uuid`, 'DELETE')
  assert.equal(refused.status, 400)
  assert.deepEqual(ctx.events, [],
    'a refused id changed nothing, so it must announce nothing')
})

test('deleting a real session removes its directory and its projection cache', async () => {
  // Built in a throwaway HOME so the assertion is about this code's behaviour and
  // cannot touch a real profile. os.homedir() reads HOME on POSIX and USERPROFILE
  // on Windows, so both are set for the duration.
  const real = os.homedir()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-session-'))
  process.env.USERPROFILE = root
  process.env.HOME = root

  try {
    // A second module instance so it picks up the redirected home.
    const mod = await import(`../src/sessions.js?t=${Date.now()}`)
    const cwd = 'D:\\CODE\\dsh-plus-plus'
    const id = 'session-11111111-2222-4333-8444-555555555555'

    const dir = path.join(root, '.dsh', 'sessions', mod.projectKey(cwd), mod.encodeSegment(id))
    const cache = path.join(root, '.dsh', 'storages', 'session_projcache', 'sessions', `${id}.json`)
    fs.mkdirSync(dir, { recursive: true })
    fs.mkdirSync(path.dirname(cache), { recursive: true })
    fs.writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), 'log')
    fs.writeFileSync(cache, '{}')

    // A sibling session that must survive: deleting one session must not take
    // another with it.
    const keep = 'session-99999999-8888-4777-8666-555555555555'
    const keepDir = path.join(root, '.dsh', 'sessions', mod.projectKey(cwd), mod.encodeSegment(keep))
    fs.mkdirSync(keepDir, { recursive: true })
    fs.writeFileSync(path.join(keepDir, 'session.v4.jsonl.zstd'), 'other')

    const result = await mod.deleteSessionFiles(id)
    assert.equal(result.deleted, true)
    assert.equal(result.alreadyAbsent, false)
    assert.equal(result.cacheRemoved, true)

    assert.equal(fs.existsSync(dir), false, 'the session directory must be gone')
    assert.equal(fs.existsSync(cache), false, 'the projection cache must be gone')
    assert.equal(fs.existsSync(keepDir), true, 'a sibling session must survive')

    // Repeating it settles.
    const again = await mod.deleteSessionFiles(id)
    assert.equal(again.deleted, false)
    assert.equal(again.alreadyAbsent, true)
  } finally {
    process.env.USERPROFILE = real
    process.env.HOME = real
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('the path encoders match the host byte for byte', () => {
  // These two functions are copied from dsh-session-persistence-jsonl, not derived.
  // A simplification — dropping the tilde escape, or collapsing separators
  // differently — silently redirects the delete to a directory that does not exist,
  // which reads as "nothing happened" rather than as a wrong path.
  assert.equal(projectKey('D:\\CODE\\dsh-plus-plus'), '--D-CODE-dsh-plus-plus--')
  assert.equal(projectKey('B:\\Document\\deepseek-harness\\default-workspace'),
    '--B-Document-deepseek-harness-default-workspace--')
  // Separators collapse to one dash however they are spaced.
  assert.equal(projectKey('/home/me/p'), '--home-me-p--')
  assert.equal(projectKey('C:/a//b'), '--C-a-b--')
  // Non-ASCII and tilde are escaped rather than dropped.
  assert.equal(projectKey('D:\\项目'), '--D-~9879~76EE--')
  assert.equal(encodeSegment('x~y'), 'x~007Ey')
  // Dot segments are neutralised outright.
  assert.equal(encodeSegment('.'), '~002E')
  assert.equal(encodeSegment('..'), '~002E~002E')
  // An empty segment is refused, not silently encoded.
  assert.throws(() => encodeSegment(''), /empty path segment/)
  assert.throws(() => projectKey(''), /empty project path/)

  // A well-formed id needs no escaping, which is why the route can match it
  // outright instead of encoding first.
  const id = 'session-3e0f1723-35cd-40c0-b17a-7f300dd85591'
  assert.equal(encodeSegment(id), id)
})
// ── runner ───────────────────────────────────────────────────────────────────

let failures = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    process.stdout.write(`  ok  ${name}\n`)
  } catch (error) {
    failures += 1
    process.stdout.write(`FAIL  ${name}\n      ${error?.message ?? error}\n`)
  }
}
process.stdout.write(`\n${tests.length - failures}/${tests.length} passed\n`)
process.exit(failures === 0 ? 0 : 1)
