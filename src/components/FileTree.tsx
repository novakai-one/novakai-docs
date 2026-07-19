/**
 * src/components/FileTree.tsx — recursive, collapsible folder tree.
 * Dumb component: blocks in, events out.
 */
import { ChevronRight, FileText, Folder, Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { FileEntry } from '../../shared/types'
import type { TreeDir } from '../lib/tree'
import { cn } from '@/lib/utils'

export const NEW_MS = 10 * 60 * 1000

export function NewBadge({ mtime, now }: { mtime: number; now: number }) {
  if (now - mtime >= NEW_MS) return null
  return (
    <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
      NEW
    </span>
  )
}

export function CopyBadge({ entry, rootLabel }: { entry: FileEntry; rootLabel: (r: string) => string }) {
  if (entry.copies.length <= 1) return null
  return (
    <span
      className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400"
      title={`${entry.copies.length} identical copies (worktree dedup):\n${entry.copies
        .map((c) => `• ${rootLabel(c.root)}/${c.path}`)
        .join('\n')}`}
    >
      ×{entry.copies.length}
    </span>
  )
}

export function FavStar() {
  return <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
}

export interface FileTreeProps {
  root: string
  tree: TreeDir
  expandedDirs: ReadonlySet<string>
  onToggleDir: (key: string) => void
  selectedId: string | null
  onSelect: (f: FileEntry) => void
  favoriteIds: ReadonlySet<string>
  now: number
  rootLabel: (r: string) => string
}

export function FileTree({
  root,
  tree,
  expandedDirs,
  onToggleDir,
  selectedId,
  onSelect,
  favoriteIds,
  now,
  rootLabel,
}: FileTreeProps) {
  const renderFile = (f: FileEntry, depth: number) => (
    <button
      key={f.id}
      onClick={() => onSelect(f)}
      style={{ paddingLeft: 12 + depth * 14 }}
      className={cn(
        'w-full rounded-md py-1.5 pr-2 text-left transition-colors hover:bg-accent',
        selectedId === f.id && 'bg-accent',
      )}
    >
      <div className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{f.name}</span>
        {favoriteIds.has(f.id) && <FavStar />}
        <NewBadge mtime={f.mtime} now={now} />
        <CopyBadge entry={f} rootLabel={rootLabel} />
      </div>
      <div className="mt-0.5 pl-5 text-[11px] text-muted-foreground">
        {formatDistanceToNow(f.mtime, { addSuffix: true })}
      </div>
    </button>
  )

  const renderDir = (node: TreeDir, depth: number): React.ReactNode => {
    const key = `${root}::${node.fullPath}`
    const expanded = expandedDirs.has(key)
    return (
      <div key={key}>
        <button
          onClick={() => onToggleDir(key)}
          style={{ paddingLeft: 12 + depth * 14 }}
          className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors hover:bg-accent"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm font-medium">{node.name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{node.count}</span>
        </button>
        {expanded && (
          <div>
            {node.dirs.map((d) => renderDir(d, depth + 1))}
            {node.files.map((f) => renderFile(f, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {tree.dirs.map((d) => renderDir(d, 0))}
      {tree.files.map((f) => renderFile(f, 0))}
      {tree.count === 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground">No markdown files here.</div>
      )}
    </div>
  )
}
