/**
 * server/middleware.test.ts — HTTP-edge integration tests for the HQ routes.
 * Real node server on an ephemeral port, temp appDir per test. The existing
 * routes (files/roots/tasks/store) are covered by their module tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { HQBlock, HQStoreData } from '../shared/hq'
import { createMdApiMiddleware } from './middleware'

let tmp = ''
let server: http.Server | null = null
let base = ''

const T = '2026-01-01T00:00:00.000Z'
const block = (id: string, extra: Partial<HQBlock> = {}): HQBlock => ({
  id,
  kind: 'task',
  title: id,
  created: T,
  updated: T,
  ...extra,
})
const line = (b: HQBlock) => JSON.stringify(b)

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novakai-docs-mw-'))
  fs.mkdirSync(path.join(tmp, 'data'))
  const handler = createMdApiMiddleware({ appDir: tmp, roots: [] })
  server = http.createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 404
      res.end()
    }),
  )
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise<void>((resolve) => server!.close(() => resolve()))
  fs.rmSync(tmp, { recursive: true, force: true })
})

async function req(method: string, url: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: await res.json() }
}

describe('HQ middleware routes (integration, temp appDir)', () => {
  it('GET rejects an unknown store with 400 and a reason', async () => {
    const { status, json } = await req('GET', '/api/hq?store=nope')
    expect(status).toBe(400)
    expect((json as { error: string }).error).toBe('unknown store')
  })

  it('GET returns an empty store (not an error) for a missing file', async () => {
    const { status, json } = await req('GET', '/api/hq?store=tasks')
    expect(status).toBe(200)
    const data = json as HQStoreData
    expect(data.store).toBe('tasks')
    expect(data.blocks).toEqual([])
    expect(data.errors).toEqual([])
  })

  it('GET surfaces corrupt lines with line numbers', async () => {
    fs.writeFileSync(path.join(tmp, 'data', 'tasks.jsonl'), `${line(block('a'))}\n{oops\n`)
    const { json } = await req('GET', '/api/hq?store=tasks')
    const data = json as HQStoreData
    expect(data.blocks.map((b) => b.id)).toEqual(['a'])
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0].line).toBe(2)
  })

  it('POST creates a block, persists it, and returns it', async () => {
    const { status, json } = await req('POST', '/api/hq?store=tasks', {
      title: 'ship it',
      status: 'todo',
      priority: 'important',
    })
    expect(status).toBe(200)
    const created = json as HQBlock
    expect(created.title).toBe('ship it')
    expect(created.kind).toBe('tasks') // defaults to the store name
    expect(created.status).toBe('todo')
    expect(created.priority).toBe('important')
    const onDisk = fs.readFileSync(path.join(tmp, 'data', 'tasks.jsonl'), 'utf-8')
    expect(onDisk).toBe(`${JSON.stringify(created)}\n`)
  })

  it('POST requires a title', async () => {
    const { status } = await req('POST', '/api/hq?store=tasks', { title: '  ' })
    expect(status).toBe(400)
  })

  it('PATCH applies a partial update, bumps updated, and 404s unknown ids', async () => {
    fs.writeFileSync(path.join(tmp, 'data', 'tasks.jsonl'), line(block('a', { status: 'todo' })) + '\n')
    const { status, json } = await req('PATCH', '/api/hq/a?store=tasks', { status: 'done', notes: 'n' })
    expect(status).toBe(200)
    const updated = json as HQBlock
    expect(updated.status).toBe('done')
    expect(updated.notes).toBe('n')
    expect(Date.parse(updated.updated)).toBeGreaterThan(Date.parse(T))

    const missing = await req('PATCH', '/api/hq/ghost?store=tasks', { status: 'done' })
    expect(missing.status).toBe(404)
  })

  it('PATCH null clears an optional field and protected keys are not patchable', async () => {
    fs.writeFileSync(path.join(tmp, 'data', 'tasks.jsonl'), line(block('a', { status: 'todo' })) + '\n')
    const cleared = await req('PATCH', '/api/hq/a?store=tasks', { status: null })
    expect(cleared.status).toBe(200)
    expect('status' in (cleared.json as HQBlock)).toBe(false)

    const protectedOnly = await req('PATCH', '/api/hq/a?store=tasks', { id: 'evil', kind: 'evil' })
    expect(protectedOnly.status).toBe(400)
    const after = (await req('GET', '/api/hq?store=tasks')).json as HQStoreData
    expect(after.blocks[0].id).toBe('a')
    expect(after.blocks[0].kind).toBe('task')
  })

  it('DELETE removes the block and 404s unknown ids', async () => {
    fs.writeFileSync(path.join(tmp, 'data', 'tasks.jsonl'), `${line(block('a'))}\n${line(block('b'))}\n`)
    const { status, json } = await req('DELETE', '/api/hq/a?store=tasks')
    expect(status).toBe(200)
    expect((json as HQBlock).id).toBe('a')
    const after = (await req('GET', '/api/hq?store=tasks')).json as HQStoreData
    expect(after.blocks.map((b) => b.id)).toEqual(['b'])

    const missing = await req('DELETE', '/api/hq/ghost?store=tasks')
    expect(missing.status).toBe(404)
  })

  it('reorder persists the explicit order; unknown ids are ignored, unmentioned blocks keep their place at the end', async () => {
    fs.writeFileSync(
      path.join(tmp, 'data', 'tasks.jsonl'),
      `${line(block('a'))}\n${line(block('b'))}\n${line(block('c'))}\n`,
    )
    const { status, json } = await req('POST', '/api/hq/reorder?store=tasks', { ids: ['c', 'ghost', 'a'] })
    expect(status).toBe(200)
    expect((json as HQStoreData).blocks.map((b) => b.id)).toEqual(['c', 'a', 'b'])
    const raw = fs.readFileSync(path.join(tmp, 'data', 'tasks.jsonl'), 'utf-8').trim().split('\n')
    expect(raw.map((l) => (JSON.parse(l) as HQBlock).id)).toEqual(['c', 'a', 'b'])
  })

  it('reorder validates its body', async () => {
    const { status } = await req('POST', '/api/hq/reorder?store=tasks', { ids: ['a', 1] })
    expect(status).toBe(400)
  })
})

describe('HQ read-only external stores (provenance + guards)', () => {
  let etmp = ''
  let storesDir = ''
  let eserver: http.Server | null = null
  let ebase = ''

  const start = async (deps: Parameters<typeof createMdApiMiddleware>[0]) => {
    const handler = createMdApiMiddleware(deps)
    eserver = http.createServer((rq, rs) => handler(rq, rs, () => { rs.statusCode = 404; rs.end() }))
    await new Promise<void>((resolve) => eserver!.listen(0, '127.0.0.1', resolve))
    ebase = `http://127.0.0.1:${(eserver.address() as AddressInfo).port}`
  }
  const ereq = async (method: string, url: string, body?: unknown) => {
    const res = await fetch(`${ebase}${url}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, json: (await res.json().catch(() => null)) as unknown }
  }

  beforeEach(() => {
    etmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novakai-docs-ext-'))
    storesDir = path.join(etmp, 'stores')
    fs.mkdirSync(storesDir)
    delete process.env.NVK_STORES_DIR
  })
  afterEach(async () => {
    if (eserver) await new Promise<void>((resolve) => eserver!.close(() => resolve()))
    eserver = null
    delete process.env.NVK_STORES_DIR
    fs.rmSync(etmp, { recursive: true, force: true })
  })

  it('GET serves adapted external blocks and stamps readOnly/source/dir', async () => {
    const log = { id: 'log_1', kind: 'log', ts: T, body: 'Observed a thing.' }
    fs.writeFileSync(path.join(storesDir, 'captains-log.jsonl'), JSON.stringify(log) + '\n')
    await start({ appDir: etmp, roots: [], storesDir })
    const { status, json } = await ereq('GET', '/api/hq?store=captains-log')
    expect(status).toBe(200)
    const data = json as HQStoreData
    expect(data.readOnly).toBe(true)
    expect(data.source).toBe('external')
    expect(data.dir).toBe(storesDir)
    expect(data.blocks[0].title).toBe('Observed a thing.')
    expect(data.blocks[0].created).toBe(T)
  })

  it('all four mutators return 405 and leave the file bytes unchanged', async () => {
    const file = path.join(storesDir, 'tasks.jsonl')
    const original = JSON.stringify({ id: 't1', kind: 'task', status: 'todo', title: 'keep me', created: T, updated: T }) + '\n'
    fs.writeFileSync(file, original)
    await start({ appDir: etmp, roots: [], storesDir })

    for (const [method, url, body] of [
      ['POST', '/api/hq?store=tasks', { title: 'nope' }],
      ['POST', '/api/hq/reorder?store=tasks', { ids: ['t1'] }],
      ['PATCH', '/api/hq/t1?store=tasks', { status: 'done' }],
      ['DELETE', '/api/hq/t1?store=tasks', undefined],
    ] as const) {
      const { status, json } = await ereq(method, url, body)
      expect(status).toBe(405)
      expect((json as { error: string }).error).toBe('stores are read-only')
    }
    expect(fs.readFileSync(file, 'utf-8')).toBe(original)
  })

  it('a missing source directory surfaces sourceError with the path', async () => {
    const missing = path.join(etmp, 'gone')
    await start({ appDir: etmp, roots: [], storesDir: missing })
    const { status, json } = await ereq('GET', '/api/hq?store=requests')
    expect(status).toBe(200)
    const data = json as HQStoreData
    expect(data.blocks).toEqual([])
    expect(data.sourceError).toContain(missing)
  })

  it('resolves deps > env > internal fallback', async () => {
    // env only → external
    process.env.NVK_STORES_DIR = storesDir
    await start({ appDir: etmp, roots: [] })
    let data = (await ereq('GET', '/api/hq?store=tasks')).json as HQStoreData
    expect(data.source).toBe('external')
    expect(data.readOnly).toBe(true)
    expect(data.dir).toBe(storesDir)
    await new Promise<void>((resolve) => eserver!.close(() => resolve()))
    eserver = null

    // neither → internal writable fallback
    delete process.env.NVK_STORES_DIR
    fs.mkdirSync(path.join(etmp, 'data'), { recursive: true })
    await start({ appDir: etmp, roots: [] })
    data = (await ereq('GET', '/api/hq?store=tasks')).json as HQStoreData
    expect(data.source).toBe('internal')
    expect(data.readOnly).toBe(false)
  })
})
