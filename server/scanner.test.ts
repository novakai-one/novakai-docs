import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanRoot, type RawFile } from './scanner'

let tmp = ''

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novakai-docs-scan-'))
  fs.writeFileSync(path.join(tmp, 'a.md'), '# a')
  fs.mkdirSync(path.join(tmp, 'sub'))
  fs.writeFileSync(path.join(tmp, 'sub', 'b.md'), '# b')
  fs.mkdirSync(path.join(tmp, '.hidden'))
  fs.writeFileSync(path.join(tmp, '.hidden', 'z.md'), '# z')
  fs.mkdirSync(path.join(tmp, 'node_modules'))
  fs.writeFileSync(path.join(tmp, 'node_modules', 'junk.md'), '# junk')
  fs.mkdirSync(path.join(tmp, '.git'))
  fs.writeFileSync(path.join(tmp, '.git', 'internal.md'), '# internal')
  fs.writeFileSync(path.join(tmp, 'image.png'), 'not markdown')
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('scanRoot (integration, temp dirs)', () => {
  it('collects markdown, includes dot-folders, skips VCS/build junk', () => {
    const out: RawFile[] = []
    const { error } = scanRoot(tmp, out)
    expect(error).toBeNull()
    const rels = out.map((f) => f.rel).sort()
    expect(rels).toEqual(['.hidden/z.md', 'a.md', 'sub/b.md'])
  })

  it('reports an error for a missing root instead of a fake empty scan', () => {
    const out: RawFile[] = []
    const { error } = scanRoot(path.join(tmp, 'nope'), out)
    expect(error).not.toBeNull()
    expect(out).toEqual([])
  })

  it('honors the depth cap', () => {
    let dir = tmp
    for (let i = 0; i < 12; i++) {
      dir = path.join(dir, `d${i}`)
      fs.mkdirSync(dir)
    }
    fs.writeFileSync(path.join(dir, 'too-deep.md'), '# deep')
    const out: RawFile[] = []
    scanRoot(tmp, out, { maxDepth: 4 })
    expect(out.map((f) => f.rel)).not.toContain('too-deep.md')
  })
})
