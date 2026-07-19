/**
 * src/hooks/useFileIndex.ts — owns polling the docs server.
 * Detects brand-new files and mtime changes to the currently open file.
 * UI stays dumb: it gets typed blocks and callbacks.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileEntry, RootInfo, RootStatus } from '../../shared/types'
import { api } from '../lib/api'

export interface UseFileIndexOptions {
  pollMs?: number
  /** Ref to the currently selected watched-file id (`root::path`), if any. */
  selectedIdRef: React.RefObject<string | null>
  /** A file appeared that was not in the previous index. */
  onNewFile?: (f: FileEntry) => void
  /** The open file changed on disk. */
  onSelectedChanged?: (id: string) => void
}

export interface FileIndex {
  files: FileEntry[]
  roots: RootInfo[]
  statuses: RootStatus[]
  truncated: boolean
  refresh: () => Promise<void>
}

export function useFileIndex({
  pollMs = 5000,
  selectedIdRef,
  onNewFile,
  onSelectedChanged,
}: UseFileIndexOptions): FileIndex {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [roots, setRoots] = useState<RootInfo[]>([])
  const [statuses, setStatuses] = useState<RootStatus[]>([])
  const [truncated, setTruncated] = useState(false)
  const prevRef = useRef<FileEntry[]>([])
  // callbacks through refs so the poll loop never goes stale
  const onNewFileRef = useRef(onNewFile)
  const onChangedRef = useRef(onSelectedChanged)
  useEffect(() => {
    onNewFileRef.current = onNewFile
    onChangedRef.current = onSelectedChanged
  }, [onNewFile, onSelectedChanged])

  const refresh = useCallback(async () => {
    try {
      const [rootsList, index] = await Promise.all([api.roots(), api.files()])
      setRoots(rootsList.roots)
      setStatuses(index.roots)
      setTruncated(index.truncated)

      const prev = prevRef.current
      if (prev.length > 0) {
        const known = new Set(prev.map((f) => f.id))
        const brandNew = index.files.find((f) => !known.has(f.id))
        if (brandNew) onNewFileRef.current?.(brandNew)

        const sel = selectedIdRef.current
        if (sel) {
          const before = prev.find((f) => f.id === sel)
          const nowE = index.files.find((f) => f.id === sel)
          if (nowE && before && nowE.mtime !== before.mtime) onChangedRef.current?.(sel)
        }
      }
      prevRef.current = index.files
      setFiles(index.files)
    } catch {
      /* server unreachable — keep showing the last good index */
    }
  }, [selectedIdRef])

  useEffect(() => {
    // Deferred so the effect body itself stays free of setState; the first
    // poll fires immediately after mount, then every pollMs.
    const first = setTimeout(() => void refresh(), 0)
    const t = setInterval(() => void refresh(), pollMs)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [refresh, pollMs])

  return { files, roots, statuses, truncated, refresh }
}
