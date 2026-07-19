/**
 * server/storeFile.ts — StoreData (favorites + recents + HQ layout) on disk.
 * fs edge; the operations on the block itself live in shared/store.ts (pure).
 */
import fs from 'node:fs'
import type { FileRef, HQLayout, StoreData } from '../shared/types'
import { EMPTY_STORE, MAX_RECENTS } from '../shared/store'

export const STORE_FILE = '.novakai-docs-store.json'

const isRef = (x: unknown): x is FileRef =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as FileRef).root === 'string' &&
  typeof (x as FileRef).path === 'string'

const isHQLayout = (x: unknown): x is HQLayout => {
  if (typeof x !== 'object' || x === null) return false
  const l = x as HQLayout
  if (l.inspectorWidth !== undefined && typeof l.inspectorWidth !== 'number') return false
  if (l.inspectorOpen !== undefined && typeof l.inspectorOpen !== 'boolean') return false
  if (l.boardColumnWidths !== undefined) {
    if (typeof l.boardColumnWidths !== 'object' || l.boardColumnWidths === null) return false
    if (!Object.values(l.boardColumnWidths).every((w) => typeof w === 'number')) return false
  }
  return true
}

/** Type guard: is this a well-formed StoreData block? */
export function isStoreData(x: unknown): x is StoreData {
  if (typeof x !== 'object' || x === null) return false
  const d = x as StoreData
  return (
    Array.isArray(d.favorites) &&
    Array.isArray(d.recents) &&
    d.favorites.every(isRef) &&
    d.recents.every(isRef) &&
    (d.hqLayout === undefined || isHQLayout(d.hqLayout))
  )
}

export function loadStore(file: string): StoreData {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown
    if (isStoreData(j)) {
      return {
        favorites: j.favorites,
        recents: j.recents.slice(0, MAX_RECENTS),
        ...(j.hqLayout ? { hqLayout: j.hqLayout } : {}),
      }
    }
  } catch {
    /* no store yet */
  }
  return { ...EMPTY_STORE, favorites: [], recents: [] }
}

export function saveStore(file: string, data: StoreData): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
