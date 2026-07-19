/**
 * src/lib/tree.ts — PURE. Turns a flat file list into a folder tree for the
 * sidebar. No React, no fetch — tested with fabricated fixtures.
 */
import type { FileEntry } from '../../shared/types'

export interface TreeDir {
  name: string
  fullPath: string
  dirs: TreeDir[]
  files: FileEntry[]
  /** Total files in this subtree. */
  count: number
}

export function buildTree(files: FileEntry[]): TreeDir {
  const root: TreeDir = { name: '', fullPath: '', dirs: [], files: [], count: 0 }
  for (const f of files) {
    const parts = f.path.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.dirs.find((d) => d.name === parts[i])
      if (!child) {
        child = {
          name: parts[i],
          fullPath: parts.slice(0, i + 1).join('/'),
          dirs: [],
          files: [],
          count: 0,
        }
        node.dirs.push(child)
      }
      node = child
    }
    node.files.push(f)
  }
  const finalize = (n: TreeDir): number => {
    n.dirs.sort((a, b) => a.name.localeCompare(b.name))
    n.files.sort((a, b) => b.mtime - a.mtime)
    n.count = n.files.length + n.dirs.reduce((acc, d) => acc + finalize(d), 0)
    return n.count
  }
  finalize(root)
  return root
}
