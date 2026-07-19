import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isStoreData, loadStore, saveStore } from './storeFile'

let tmp = ''
let file = ''

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novakai-docs-store-'))
  file = path.join(tmp, 'store.json')
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('storeFile (integration, temp files)', () => {
  it('returns an empty store when the file does not exist', () => {
    expect(loadStore(file)).toEqual({ favorites: [], recents: [] })
  })

  it('round-trips a saved store', () => {
    const data = {
      favorites: [{ root: 'r', path: 'a.md' }],
      recents: [{ root: 'r', path: 'b.md' }],
    }
    saveStore(file, data)
    expect(loadStore(file)).toEqual(data)
  })

  it('falls back to empty on malformed JSON', () => {
    fs.writeFileSync(file, '{not json')
    expect(loadStore(file)).toEqual({ favorites: [], recents: [] })
  })

  it('rejects wrong shapes via the type guard', () => {
    expect(isStoreData({ favorites: [], recents: [] })).toBe(true)
    expect(isStoreData({ favorites: [{ root: 1, path: 'x' }], recents: [] })).toBe(false)
    expect(isStoreData('nope')).toBe(false)
    expect(isStoreData(null)).toBe(false)
  })

  it('round-trips hqLayout and validates it when present', () => {
    const data = {
      favorites: [],
      recents: [],
      hqLayout: { boardColumnWidths: { todo: 320 }, inspectorWidth: 340, inspectorOpen: true },
    }
    saveStore(file, data)
    expect(loadStore(file)).toEqual(data)
    expect(isStoreData(data)).toBe(true)
    expect(isStoreData({ favorites: [], recents: [], hqLayout: { inspectorWidth: 'wide' } })).toBe(false)
    expect(isStoreData({ favorites: [], recents: [], hqLayout: { boardColumnWidths: { todo: 'x' } } })).toBe(
      false,
    )
  })

  it('loads pre-HQ stores without an hqLayout field', () => {
    fs.writeFileSync(file, JSON.stringify({ favorites: [], recents: [] }))
    expect(loadStore(file)).toEqual({ favorites: [], recents: [] })
  })
})
