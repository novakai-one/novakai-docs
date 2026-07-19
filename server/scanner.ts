/**
 * server/scanner.ts — walks a root folder and collects markdown files.
 * fs edge. Reports failures per root (never a silently empty list).
 * Policy constants live here and nowhere else.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface RawFile {
  root: string
  abs: string
  /** POSIX path relative to root. */
  rel: string
  mtime: number
  size: number
}

export interface ScanOptions {
  /** Directories never descended into (build junk, VCS internals). */
  skipDirs?: ReadonlySet<string>
  maxDepth?: number
  maxFiles?: number
  /** The viewer app itself — never index our own source tree. */
  appDir?: string | null
}

export const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  '.turbo',
  'coverage',
  'target',
  '.venv',
  'venv',
  '__pycache__',
])

export const MD_RE = /\.(md|markdown|mdown|txt)$/i
export const MAX_DEPTH = 8
export const MAX_FILES = 8000

/**
 * Append markdown files under `root` to `out`.
 * Returns { error } — null on success, a reason string when the root
 * could not be read. Callers surface this; they never invent an empty scan.
 */
export function scanRoot(root: string, out: RawFile[], opts: ScanOptions = {}): { error: string | null } {
  const skip = opts.skipDirs ?? SKIP_DIRS
  const maxDepth = opts.maxDepth ?? MAX_DEPTH
  const maxFiles = opts.maxFiles ?? MAX_FILES
  const appDir = opts.appDir ?? null

  try {
    if (!fs.statSync(root).isDirectory()) return { error: 'not a directory' }
  } catch {
    return { error: 'folder does not exist' }
  }

  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || out.length >= maxFiles) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return // unreadable subdirectory — skip it, the root itself still counts
    }
    for (const e of entries) {
      if (out.length >= maxFiles) return
      if (skip.has(e.name) || e.name === '.DS_Store') continue
      const full = path.join(dir, e.name)
      if (appDir && full === appDir) continue
      if (e.isDirectory()) {
        walk(full, depth + 1)
      } else if (MD_RE.test(e.name)) {
        try {
          const st = fs.statSync(full)
          out.push({
            root,
            abs: full,
            rel: path.relative(root, full).split(path.sep).join('/'),
            mtime: st.mtimeMs,
            size: st.size,
          })
        } catch {
          /* vanished mid-scan */
        }
      }
    }
  }

  walk(root, 1)
  return { error: null }
}
