import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defaultRoots, expandHome, loadRoots, saveRoots } from './config'

let tmp = ''

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novakai-docs-config-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('config (integration, temp files)', () => {
  it('falls back to defaults when no config exists', () => {
    const defaults = [tmp]
    expect(loadRoots(path.join(tmp, 'missing.json'), defaults)).toEqual(defaults)
  })

  it('round-trips saved roots', () => {
    const file = path.join(tmp, 'roots.json')
    saveRoots(file, ['/a', '/b'])
    expect(loadRoots(file, ['/default'])).toEqual(['/a', '/b'])
  })

  it('defaultRoots includes the parent of the app dir', () => {
    const appDir = path.join(tmp, 'app')
    fs.mkdirSync(appDir)
    expect(defaultRoots(appDir)).toContain(tmp)
  })

  it('expands ~ to the home directory', () => {
    expect(expandHome('~/x')).toBe(path.join(os.homedir(), 'x'))
    expect(expandHome('/abs')).toBe('/abs')
  })
})
