/**
 * server/config.ts — which folders get watched. The only module that
 * knows where the roots config file lives. fs edge: small and boring.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface RootsConfig {
  roots: string[]
}

export const ROOTS_CONFIG_FILE = '.novakai-docs-roots.json'

export function defaultRoots(appDir: string): string[] {
  const candidates = [path.resolve(appDir, '..'), path.join(os.homedir(), 'Programming')]
  const unique = [...new Set(candidates)] // app may live inside ~/Programming
  return unique.filter((p) => {
    try {
      return fs.statSync(p).isDirectory()
    } catch {
      return false
    }
  })
}

export function loadRoots(configFile: string, defaults: string[]): string[] {
  try {
    const j = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as Partial<RootsConfig>
    if (Array.isArray(j.roots)) {
      const roots = j.roots.filter((r): r is string => typeof r === 'string')
      if (roots.length > 0) return roots
    }
  } catch {
    /* no config yet — fall back to defaults */
  }
  return [...defaults]
}

export function saveRoots(configFile: string, roots: string[]): void {
  fs.writeFileSync(configFile, JSON.stringify({ roots } satisfies RootsConfig, null, 2))
}

export function expandHome(p: string): string {
  return p.replace(/^~(?=$|\/)/, os.homedir())
}
