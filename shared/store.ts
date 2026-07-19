/**
 * shared/store.ts — pure operations on the StoreData block.
 * No fs, no fetch: same functions run in the browser (optimistic UI)
 * and could run in tests with fabricated fixtures.
 */
import type { FileRef, HQLayout, StoreData } from './types'

export const MAX_RECENTS = 12

export const EMPTY_STORE: StoreData = { favorites: [], recents: [] }

const sameRef = (a: FileRef, b: FileRef): boolean => a.root === b.root && a.path === b.path

export function isFavorite(store: StoreData, ref: FileRef): boolean {
  return store.favorites.some((f) => sameRef(f, ref))
}

/** Returns a new StoreData with the ref added to or removed from favorites. */
export function toggleFavorite(store: StoreData, ref: FileRef): StoreData {
  const has = isFavorite(store, ref)
  return {
    ...store,
    favorites: has
      ? store.favorites.filter((f) => !sameRef(f, ref))
      : [ref, ...store.favorites],
  }
}

/** Returns a new StoreData with the ref moved to the front of recents (deduped, capped). */
export function pushRecent(store: StoreData, ref: FileRef): StoreData {
  const recents = [ref, ...store.recents.filter((r) => !sameRef(r, ref))]
  return { ...store, recents: recents.slice(0, MAX_RECENTS) }
}

/** Drop refs that no longer resolve to a known file (e.g. after a root was removed). */
export function pruneStore(store: StoreData, knownIds: ReadonlySet<string>): StoreData {
  const id = (r: FileRef) => `${r.root}::${r.path}`
  return {
    ...store,
    favorites: store.favorites.filter((r) => knownIds.has(id(r))),
    recents: store.recents.filter((r) => knownIds.has(id(r))),
  }
}

/** Shallow-merge HQ layout preferences into the store (immutable). */
export function setHQLayout(store: StoreData, patch: Partial<HQLayout>): StoreData {
  return { ...store, hqLayout: { ...store.hqLayout, ...patch } }
}

/** Record one board column's width in the HQ layout (immutable). */
export function setBoardColumnWidth(store: StoreData, column: string, width: number): StoreData {
  return setHQLayout(store, {
    boardColumnWidths: { ...store.hqLayout?.boardColumnWidths, [column]: width },
  })
}
