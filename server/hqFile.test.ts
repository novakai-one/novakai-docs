import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { HQBlock } from '../shared/hq'
import { HQ_DIR, hqStoreFile, loadExternalStore, loadHQStore, saveHQStore } from './hqFile'

let tmp = ''

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novakai-docs-hq-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

const block = (id: string, extra: Partial<HQBlock> = {}): HQBlock => ({
  id,
  kind: 'task',
  title: id,
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  ...extra,
})

describe('hqFile (integration, temp files)', () => {
  it('HQ_DIR is the data directory and store files resolve inside it', () => {
    expect(HQ_DIR).toBe('data')
    expect(hqStoreFile(tmp, 'tasks')).toBe(path.join(tmp, 'tasks.jsonl'))
  })

  it('returns an empty store (not an error) when the file does not exist', () => {
    const data = loadHQStore(tmp, 'tasks')
    expect(data.store).toBe('tasks')
    expect(data.blocks).toEqual([])
    expect(data.errors).toEqual([])
    expect(data.generatedAt).toBeGreaterThan(0)
  })

  it('round-trips blocks, preserving order and extra fields', () => {
    const blocks = [block('a', { status: 'todo', focus: 'f' }), block('b')]
    saveHQStore(tmp, 'projects', blocks)
    const data = loadHQStore(tmp, 'projects')
    expect(data.blocks).toEqual(blocks)
    expect(data.errors).toEqual([])
    const raw = fs.readFileSync(hqStoreFile(tmp, 'projects'), 'utf-8')
    expect(raw.trim().split('\n')).toHaveLength(2)
  })

  it('saves atomically — no tmp file is left behind', () => {
    saveHQStore(tmp, 'tasks', [block('a')])
    expect(fs.existsSync(hqStoreFile(tmp, 'tasks'))).toBe(true)
    expect(fs.existsSync(`${hqStoreFile(tmp, 'tasks')}.tmp`)).toBe(false)
  })

  it('surfaces corrupt lines with line numbers and keeps the good blocks', () => {
    const good = JSON.stringify(block('a'))
    fs.writeFileSync(hqStoreFile(tmp, 'tasks'), `${good}\n{oops\n{"id":"x"}`)
    const data = loadHQStore(tmp, 'tasks')
    expect(data.blocks).toEqual([block('a')])
    expect(data.errors).toHaveLength(2)
    expect(data.errors.map((e) => e.line)).toEqual([2, 3])
  })

  it('an empty file saves and loads as an empty store', () => {
    saveHQStore(tmp, 'decisions', [])
    expect(fs.readFileSync(hqStoreFile(tmp, 'decisions'), 'utf-8')).toBe('')
    expect(loadHQStore(tmp, 'decisions').blocks).toEqual([])
  })
})

describe('loadExternalStore (adapter + source visibility)', () => {
  it('adapts external record shapes: ts→timestamps, body→title, passthrough kept', () => {
    const log = { id: 'log_1', kind: 'log', ts: '2026-07-20T01:35:00+10:00', body: 'Verified the loop.\nMore detail.', refs: [{ kind: 'task', value: 't1' }] }
    fs.writeFileSync(hqStoreFile(tmp, 'captains-log'), JSON.stringify(log) + '\n')
    const data = loadExternalStore(tmp, 'captains-log')
    expect(data.errors).toEqual([])
    expect(data.blocks).toHaveLength(1)
    const b = data.blocks[0]
    expect(b.title).toBe('Verified the loop.') // first line of body
    expect(b.created).toBe(log.ts)
    expect(b.updated).toBe(log.ts)
    expect(b.body).toBe(log.body) // passthrough
    expect(b.ts).toBe(log.ts) // passthrough
  })

  it('adapts the updated-only refile tombstone (SEVERE-1 case)', () => {
    const tomb = { id: 'task_x', kind: 'task', status: 'refiled', refiledTo: 'mission_x', updated: '2026-07-20T08:23:31+10:00' }
    fs.writeFileSync(hqStoreFile(tmp, 'tasks'), JSON.stringify(tomb) + '\n')
    const data = loadExternalStore(tmp, 'tasks')
    expect(data.errors).toEqual([])
    expect(data.blocks).toHaveLength(1)
    const b = data.blocks[0]
    expect(b.title).toBe('task_x') // no title/question/body → id
    expect(b.created).toBe(tomb.updated) // created ?? ts ?? updated
    expect(b.updated).toBe(tomb.updated)
    expect(b.status).toBe('refiled')
  })

  it('rejects malformed lines with 1-based line numbers, keeps the good ones', () => {
    const good = JSON.stringify({ id: 'd1', kind: 'decision', ts: '2026-07-20T00:00:00+10:00', title: 'ok' })
    const badRefs = JSON.stringify({ id: 'd2', kind: 'decision', ts: '2026-07-20T00:00:00+10:00', title: 'x', refs: [{ kind: 'pr' }] })
    const noId = JSON.stringify({ kind: 'decision', ts: '2026-07-20T00:00:00+10:00', title: 'x' })
    fs.writeFileSync(hqStoreFile(tmp, 'decisions'), `${good}\n${badRefs}\n${noId}\n{oops`)
    const data = loadExternalStore(tmp, 'decisions')
    expect(data.blocks.map((b) => b.id)).toEqual(['d1'])
    expect(data.errors.map((e) => e.line)).toEqual([2, 3, 4])
    expect(data.errors[0].reason).toBe('refs is not Ref[]')
    expect(data.errors[1].reason).toBe('missing id')
    expect(data.errors[2].reason).toContain('invalid JSON')
  })

  it('a missing file inside a present dir is an empty store, not a source error', () => {
    const data = loadExternalStore(tmp, 'requests')
    expect(data.blocks).toEqual([])
    expect(data.errors).toEqual([])
    expect(data.sourceError).toBeUndefined()
  })

  it('a missing source directory surfaces a sourceError naming the path', () => {
    const missing = path.join(tmp, 'does-not-exist')
    const data = loadExternalStore(missing, 'requests')
    expect(data.blocks).toEqual([])
    expect(data.sourceError).toContain(missing)
  })
})
