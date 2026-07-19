/**
 * src/lib/paths.ts — PURE posix-style path helpers for relative paths.
 * Used for display names and for resolving relative links/assets in markdown.
 */

export const baseName = (p: string): string => p.split('/').filter(Boolean).pop() || p

export const dirName = (p: string): string => {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

/** Resolve '.' and '..' segments in a relative posix path. */
export function normalize(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

export const joinPath = (dir: string, rel: string): string =>
  normalize(dir ? `${dir}/${rel}` : rel)

/** Display name for a watch root (last path segment, or the path itself). */
export const rootName = (r: string): string => baseName(r) || r
