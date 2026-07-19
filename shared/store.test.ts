import { describe, expect, it } from 'vitest'
import type { FileRef, StoreData } from './types'
import {
  EMPTY_STORE,
  isFavorite,
  MAX_RECENTS,
  pruneStore,
  pushRecent,
  setBoardColumnWidth,
  setHQLayout,
  toggleFavorite,
} from './store'

const ref = (path: string, root = 'r'): FileRef => ({ root, path })
const store = (favorites: FileRef[] = [], recents: FileRef[] = []): StoreData => ({
  favorites,
  recents,
})

describe('toggleFavorite', () => {
  it('adds then removes, newest first', () => {
    let s = store()
    s = toggleFavorite(s, ref('a.md'))
    s = toggleFavorite(s, ref('b.md'))
    expect(s.favorites.map((f) => f.path)).toEqual(['b.md', 'a.md'])
    expect(isFavorite(s, ref('a.md'))).toBe(true)
    s = toggleFavorite(s, ref('a.md'))
    expect(isFavorite(s, ref('a.md'))).toBe(false)
    expect(s.favorites.map((f) => f.path)).toEqual(['b.md'])
  })
})

describe('pushRecent', () => {
  it('moves the ref to the front, deduped', () => {
    let s = store()
    s = pushRecent(s, ref('a.md'))
    s = pushRecent(s, ref('b.md'))
    s = pushRecent(s, ref('a.md'))
    expect(s.recents.map((r) => r.path)).toEqual(['a.md', 'b.md'])
  })

  it(`caps at MAX_RECENTS (${MAX_RECENTS})`, () => {
    let s = store()
    for (let i = 0; i < MAX_RECENTS + 5; i++) s = pushRecent(s, ref(`f${i}.md`))
    expect(s.recents).toHaveLength(MAX_RECENTS)
    expect(s.recents[0].path).toBe(`f${MAX_RECENTS + 4}.md`)
  })
})

describe('pruneStore', () => {
  it('drops refs that no longer exist in the index', () => {
    const s = store([ref('gone.md'), ref('here.md')], [ref('gone.md')])
    const pruned = pruneStore(s, new Set(['r::here.md']))
    expect(pruned.favorites.map((f) => f.path)).toEqual(['here.md'])
    expect(pruned.recents).toEqual([])
  })
})

describe('EMPTY_STORE', () => {
  it('is empty', () => {
    expect(EMPTY_STORE).toEqual({ favorites: [], recents: [] })
  })
})

describe('setHQLayout', () => {
  it('merges layout patches without touching favorites/recents', () => {
    const s = store([ref('a.md')], [])
    const next = setHQLayout(s, { inspectorOpen: true, inspectorWidth: 340 })
    expect(next.hqLayout).toEqual({ inspectorOpen: true, inspectorWidth: 340 })
    expect(next.favorites).toEqual(s.favorites)
  })

  it('merges over an existing layout instead of replacing it', () => {
    const s = setHQLayout(store(), { inspectorWidth: 340 })
    const next = setHQLayout(s, { inspectorOpen: false })
    expect(next.hqLayout).toEqual({ inspectorWidth: 340, inspectorOpen: false })
    expect(s.hqLayout).toEqual({ inspectorWidth: 340 })
  })
})

describe('setBoardColumnWidth', () => {
  it('records one column width, keeping the others', () => {
    let s = setBoardColumnWidth(store(), 'todo', 320)
    s = setBoardColumnWidth(s, 'doing', 280)
    expect(s.hqLayout?.boardColumnWidths).toEqual({ todo: 320, doing: 280 })
    s = setBoardColumnWidth(s, 'todo', 300)
    expect(s.hqLayout?.boardColumnWidths).toEqual({ todo: 300, doing: 280 })
  })
})

describe('pruneStore with hqLayout', () => {
  it('preserves hqLayout while pruning refs', () => {
    const s = setHQLayout(store([ref('gone.md')], []), { inspectorOpen: true })
    const pruned = pruneStore(s, new Set())
    expect(pruned.favorites).toEqual([])
    expect(pruned.hqLayout).toEqual({ inspectorOpen: true })
  })
})
