import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { HQBlock } from '../shared/hq'
import { HQ_DIR, hqStoreFile, loadHQStore, saveHQStore } from './hqFile'

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
    saveHQStore(tmp, 'content', [])
    expect(fs.readFileSync(hqStoreFile(tmp, 'content'), 'utf-8')).toBe('')
    expect(loadHQStore(tmp, 'content').blocks).toEqual([])
  })
})
