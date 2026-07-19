import { describe, expect, it } from 'vitest'
import { baseName, dirName, joinPath, normalize, rootName } from './paths'

describe('normalize', () => {
  it('resolves . and .. segments', () => {
    expect(normalize('a/./b/../c.md')).toBe('a/c.md')
    expect(normalize('a/b/../../c.md')).toBe('c.md')
    expect(normalize('../up.md')).toBe('up.md')
  })
  it('drops empty segments', () => {
    expect(normalize('a//b/')).toBe('a/b')
  })
})

describe('joinPath', () => {
  it('joins relative to a directory', () => {
    expect(joinPath('docs/a', '../b.md')).toBe('docs/b.md')
    expect(joinPath('', 'x.md')).toBe('x.md')
  })
})

describe('dirName / baseName / rootName', () => {
  it('splits paths', () => {
    expect(dirName('a/b/c.md')).toBe('a/b')
    expect(dirName('c.md')).toBe('')
    expect(baseName('a/b/c.md')).toBe('c.md')
    expect(rootName('/Users/x/Programming')).toBe('Programming')
    expect(rootName('/')).toBe('/')
  })
})
