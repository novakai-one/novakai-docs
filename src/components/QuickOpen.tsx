/**
 * src/components/QuickOpen.tsx — ⌘K palette: fuzzy-find any file, Enter opens.
 * Self-contained: owns its query and cursor state.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { FileEntry } from '../../shared/types'
import { rootName } from '../lib/paths'
import { cn } from '@/lib/utils'
import { CopyBadge, FavStar, NewBadge } from './FileTree'

const PAGE = 100

export interface QuickOpenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: FileEntry[]
  favoriteIds: ReadonlySet<string>
  onSelect: (f: FileEntry) => void
  now: number
}

export function QuickOpen({ open, onOpenChange, files, favoriteIds, onSelect, now }: QuickOpenProps) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? files.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.path.toLowerCase().includes(q) ||
            f.root.toLowerCase().includes(q),
        )
      : files
    return base.slice(0, PAGE)
  }, [files, query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const reset = () => {
    setQuery('')
    setIndex(0)
  }

  const pick = (f: FileEntry) => {
    onSelect(f)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (o) reset()
      }}
    >
      <DialogContent className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Quick open file</DialogTitle>
        <div className="border-b px-4 py-3">
          <Input
            autoFocus
            placeholder="Type a file name or path…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(i + 1, matches.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const f = matches[index]
                if (f) pick(f)
              }
            }}
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {matches.map((f, i) => (
            <button
              key={f.id}
              data-idx={i}
              onMouseEnter={() => setIndex(i)}
              onClick={() => pick(f)}
              className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left', i === index && 'bg-accent')}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-sm font-medium">{f.name}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {rootName(f.root)}/{f.path}
              </span>
              {favoriteIds.has(f.id) && <FavStar />}
              <CopyBadge entry={f} rootLabel={rootName} />
              <NewBadge mtime={f.mtime} now={now} />
            </button>
          ))}
          {matches.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No files found.</div>
          )}
        </div>
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          ↑↓ navigate · ↵ open · esc close — {matches.length} of {files.length} files
        </div>
      </DialogContent>
    </Dialog>
  )
}
