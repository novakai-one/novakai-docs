/**
 * src/components/Sidebar.tsx — navigation: favorites, recents, watched roots,
 * folder trees, dropped files, search, add/remove folders. Dumb component.
 */
import { useState } from 'react'
import {
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  FolderPlus,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FileEntry, RootInfo, RootStatus } from '../../shared/types'
import { rootName } from '../lib/paths'
import type { TreeDir } from '../lib/tree'
import type { DroppedFile } from '../lib/ui'
import { cn } from '@/lib/utils'
import { CopyBadge, FavStar, FileTree, NewBadge } from './FileTree'

export interface SidebarProps {
  roots: RootInfo[]
  statuses: RootStatus[]
  trees: Map<string, TreeDir>
  selectedId: string | null
  onSelectFile: (f: FileEntry) => void
  dropped: DroppedFile[]
  selectedDropIdx: number | null
  onSelectDropped: (idx: number) => void
  favorites: FileEntry[]
  recents: FileEntry[]
  favoriteIds: ReadonlySet<string>
  expandedDirs: ReadonlySet<string>
  onToggleDir: (key: string) => void
  collapsedRoots: ReadonlySet<string>
  onToggleRoot: (root: string) => void
  onRemoveRoot: (path: string) => void
  /** Returns null on success, an error message otherwise. */
  onAddRoot: (path: string) => Promise<string | null>
  search: string
  onSearch: (s: string) => void
  searchMatches: FileEntry[]
  onOpenPalette: () => void
  totalFiles: number
  now: number
}

export function Sidebar(p: SidebarProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [addPath, setAddPath] = useState('')
  const [addError, setAddError] = useState('')

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    const err = await p.onAddRoot(addPath)
    if (err) {
      setAddError(err)
      return
    }
    setAddPath('')
    setAddOpen(false)
  }

  const flatRow = (f: FileEntry, showPath: boolean) => (
    <button
      key={f.id}
      onClick={() => p.onSelectFile(f)}
      className={cn(
        'w-full rounded-md px-3 py-1.5 text-left transition-colors hover:bg-accent',
        p.selectedId === f.id && 'bg-accent',
      )}
    >
      <div className="flex items-center gap-1.5">
        {showPath ? (
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <FavStar />
        )}
        <span className="flex-1 truncate text-sm">{f.name}</span>
        <NewBadge mtime={f.mtime} now={p.now} />
        <CopyBadge entry={f} rootLabel={rootName} />
      </div>
      <div className="mt-0.5 truncate pl-5 text-[11px] text-muted-foreground">
        {showPath ? `${rootName(f.root)}/${f.path}` : formatDistanceToNow(f.mtime, { addSuffix: true })}
      </div>
    </button>
  )

  const searching = p.search.trim().length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="font-semibold tracking-tight">Novakai Docs</h1>
          <span className="ml-auto text-xs text-muted-foreground">
            {p.totalFiles} {p.totalFiles === 1 ? 'file' : 'files'}
          </span>
        </div>
        <button
          onClick={p.onOpenPalette}
          className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Quick open…</span>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {p.dropped.length > 0 && (
          <Section title="Dropped">
            {p.dropped.map((d, i) => (
              <button
                key={`drop-${i}`}
                onClick={() => p.onSelectDropped(i)}
                className={cn(
                  'w-full rounded-md px-3 py-1.5 text-left transition-colors hover:bg-accent',
                  p.selectedDropIdx === i && 'bg-accent',
                )}
              >
                <div className="truncate text-sm">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">from your computer</div>
              </button>
            ))}
          </Section>
        )}

        {!searching && p.favorites.length > 0 && (
          <Section title="Favorites">{p.favorites.map((f) => flatRow(f, false))}</Section>
        )}

        {!searching && p.recents.length > 0 && (
          <Section title="Recent" icon={<Clock className="h-3 w-3" />}>
            {p.recents.slice(0, 8).map((f) => flatRow(f, true))}
          </Section>
        )}

        {searching ? (
          <>
            <Section title={`${p.searchMatches.length} matches`}>
              {p.searchMatches.map((f) => flatRow(f, true))}
            </Section>
            {p.searchMatches.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                No files match “{p.search}”.
              </div>
            )}
          </>
        ) : (
          p.roots.map((root) => {
            const tree = p.trees.get(root.path)
            const status = p.statuses.find((s) => s.path === root.path)
            const collapsed = p.collapsedRoots.has(root.path)
            return (
              <div key={root.path} className="mb-1">
                <div className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-accent">
                  <button
                    onClick={() => p.onToggleRoot(root.path)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left"
                    title={root.path}
                  >
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                        !collapsed && 'rotate-90',
                      )}
                    />
                    <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="truncate text-sm font-semibold">{root.name}</span>
                    {status?.error ? (
                      <span title={`Scan failed: ${status.error}`}>
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {tree?.count ?? 0}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => p.onRemoveRoot(root.path)}
                    title="Stop watching this folder"
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {!collapsed && tree && (
                  <FileTree
                    root={root.path}
                    tree={tree}
                    expandedDirs={p.expandedDirs}
                    onToggleDir={p.onToggleDir}
                    selectedId={p.selectedId}
                    onSelect={p.onSelectFile}
                    favoriteIds={p.favoriteIds}
                    now={p.now}
                    rootLabel={rootName}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="border-t p-2">
        <div className="relative mb-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter files…"
            className="h-8 pl-8 text-xs"
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
          />
        </div>
        {addOpen ? (
          <form onSubmit={(e) => void submitAdd(e)} className="space-y-1.5">
            <Input
              autoFocus
              placeholder="/any/folder or ~/folder"
              className="h-8 text-xs"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
            />
            {addError && <p className="text-[11px] text-destructive">{addError}</p>}
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" className="h-7 flex-1 text-xs">
                Watch folder
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setAddOpen(false)
                  setAddError('')
                  setAddPath('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Add any folder…
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}
