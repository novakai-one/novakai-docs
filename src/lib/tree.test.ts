import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../shared/types'
import { buildTree } from './tree'

let n = 0
function entry(path: string, mtime = 0): FileEntry {
  n += 1
  return {
    id: `r::${path}`,
    root: 'r',
    path,
    name: path.split('/').pop() ?? path,
    mtime: mtime || n,
    size: 1,
    copies: [{ root: 'r', path, mtime: mtime || n }],
  }
}

describe('buildTree', () => {
  it('nests files into folders and counts subtrees', () => {
    const tree = buildTree([entry('a/b/c.md'), entry('a/d.md'), entry('e.md')])
    expect(tree.count).toBe(3)
    expect(tree.files.map((f) => f.name)).toEqual(['e.md'])
    const a = tree.dirs.find((d) => d.name === 'a')
    expect(a?.count).toBe(2)
    const b = a?.dirs.find((d) => d.name === 'b')
    expect(b?.files.map((f) => f.name)).toEqual(['c.md'])
  })

  it('sorts dirs alphabetically and files newest-first', () => {
    const tree = buildTree([
      entry('z/f.md', 1),
      entry('m/f.md', 2),
      entry('old.md', 1),
      entry('new.md', 9),
    ])
    expect(tree.dirs.map((d) => d.name)).toEqual(['m', 'z'])
    expect(tree.files.map((f) => f.name)).toEqual(['new.md', 'old.md'])
  })

  it('is deterministic: same input, same tree', () => {
    const input = [entry('a/x.md'), entry('a/y.md'), entry('b/z.md')]
    expect(buildTree(input)).toEqual(buildTree(input))
  })
})
