/**
 * server/hashing.ts — content hashes for dedup, with an mtime/size cache
 * so polling only re-reads files that actually changed. fs edge.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import type { RawFile } from './scanner'

export interface HashCache {
  hashFor: (f: RawFile) => string
  size: () => number
}

export function createHashCache(): HashCache {
  const cache = new Map<string, { mtime: number; size: number; hash: string }>()

  const hashFor = (f: RawFile): string => {
    const hit = cache.get(f.abs)
    if (hit && hit.mtime === f.mtime && hit.size === f.size) return hit.hash
    let hash = ''
    try {
      hash = crypto.createHash('sha256').update(fs.readFileSync(f.abs)).digest('hex').slice(0, 16)
    } catch {
      /* unreadable file — empty hash keeps it ungrouped */
    }
    cache.set(f.abs, { mtime: f.mtime, size: f.size, hash })
    return hash
  }

  return { hashFor, size: () => cache.size }
}
