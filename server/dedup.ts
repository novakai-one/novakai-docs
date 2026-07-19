/**
 * server/dedup.ts — PURE. Groups physically-identical files (same content
 * hash, e.g. git worktree checkouts) into one logical FileEntry.
 * No fs, no crypto — the hash function is injected, so tests use fixtures.
 */
import type { FileEntry } from '../shared/types'
import type { RawFile } from './scanner'

export function dedupFiles(raw: RawFile[], hashFor: (f: RawFile) => string): FileEntry[] {
  const groups = new Map<string, RawFile[]>()
  for (const f of raw) {
    const h = hashFor(f)
    const key = h || `nohash:${f.abs}`
    const g = groups.get(key)
    if (g) g.push(f)
    else groups.set(key, [f])
  }

  const entries: FileEntry[] = []
  for (const g of groups.values()) {
    g.sort((a, b) => b.mtime - a.mtime)
    const primary = g[0]
    entries.push({
      id: `${primary.root}::${primary.rel}`,
      root: primary.root,
      path: primary.rel,
      name: primary.rel.split('/').pop() ?? primary.rel,
      mtime: primary.mtime,
      size: primary.size,
      copies: g.map((f) => ({ root: f.root, path: f.rel, mtime: f.mtime })),
    })
  }
  entries.sort((a, b) => b.mtime - a.mtime)
  return entries
}
