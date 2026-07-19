import { describe, expect, it } from 'vitest'
import { dedupFiles } from './dedup'
import type { RawFile } from './scanner'

function raw(root: string, rel: string, mtime: number): RawFile {
  return { root, abs: `${root}/${rel}`, rel, mtime, size: 10 }
}

describe('dedupFiles', () => {
  it('collapses identical content into one entry with copies, newest is primary', () => {
    const files = [raw('w1', 'a/CLAUDE.md', 100), raw('w2', 'b/CLAUDE.md', 200)]
    const hash = new Map([
      ['w1/a/CLAUDE.md', 'samehash'],
      ['w2/b/CLAUDE.md', 'samehash'],
    ])
    const out = dedupFiles(files, (f) => hash.get(f.abs) ?? '')
    expect(out).toHaveLength(1)
    expect(out[0].root).toBe('w2') // newest copy wins
    expect(out[0].copies).toHaveLength(2)
  })

  it('keeps differing content separate', () => {
    const files = [raw('w1', 'README.md', 100), raw('w2', 'README.md', 200)]
    const hash = new Map([
      ['w1/README.md', 'aaa'],
      ['w2/README.md', 'bbb'],
    ])
    const out = dedupFiles(files, (f) => hash.get(f.abs) ?? '')
    expect(out).toHaveLength(2)
    expect(out[0].mtime).toBe(200) // sorted newest first
  })

  it('never groups unhashable files together', () => {
    const files = [raw('w1', 'a.md', 1), raw('w1', 'b.md', 2)]
    const out = dedupFiles(files, () => '')
    expect(out).toHaveLength(2)
  })
})
