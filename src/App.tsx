/**
 * src/App.tsx — composition root. Owns state, wires typed blocks between
 * the API SDK (src/lib/api.ts) and the dumb components. All logic with
 * opinions lives in shared/, server/, src/lib, src/hooks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Upload, X } from 'lucide-react'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { FileEntry, FileRef, HQLayout, StoreData } from '../shared/types'
import { EMPTY_STORE, isFavorite, pushRecent, setHQLayout, toggleFavorite } from '../shared/store'
import { api } from './lib/api'
import { baseName, rootName } from './lib/paths'
import { buildTree, type TreeDir } from './lib/tree'
import { selectionId, type DroppedFile, type Selection, type View } from './lib/ui'
import { useFileIndex } from './hooks/useFileIndex'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { MarkdownView } from './components/MarkdownView'
import { QuickOpen } from './components/QuickOpen'
import { TasksTab } from './components/TasksTab'
import { HQBoard } from './components/hq/HQBoard'
import { HQTimeline } from './components/hq/HQTimeline'
import { HQProjects } from './components/hq/HQProjects'

const LAYOUT_KEY = 'novakai-docs:layout'
const LAST_KEY = 'novakai-docs:last'
const EXPANDED_KEY = 'novakai-docs:expanded'
const COLLAPSED_KEY = 'novakai-docs:collapsed-roots'
const DARK_KEY = 'novakai-docs:dark'

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}

function loadLayout(): { [id: string]: number } | undefined {
  try {
    return (JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null') ?? undefined) as
      | { [id: string]: number }
      | undefined
  } catch {
    return undefined
  }
}

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [dropped, setDropped] = useState<DroppedFile[]>([])
  const [content, setContent] = useState('')
  const [contentLoading, setContentLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [raw, setRaw] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [newFile, setNewFile] = useState<FileEntry | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [view, setView] = useState<View>('docs')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [store, setStore] = useState<StoreData>(EMPTY_STORE)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => loadSet(EXPANDED_KEY))
  const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(() => loadSet(COLLAPSED_KEY))
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(DARK_KEY)
    if (saved !== null) return saved === '1'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const selRef = useRef<Selection | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const storeRef = useRef<StoreData>(EMPTY_STORE)
  const panelRef = useRef<PanelImperativeHandle | null>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)

  /* ---------- store (favorites + recents), optimistic + persisted ---------- */

  const updateStore = useCallback((mutate: (s: StoreData) => StoreData) => {
    const next = mutate(storeRef.current)
    storeRef.current = next
    setStore(next)
    api.putStore(next).catch(() => {
      /* local copy survives; server keeps the previous version */
    })
  }, [])

  /** HQ views persist their layout (column widths, inspector) in the store. */
  const onHQLayout = useCallback((patch: Partial<HQLayout>) => updateStore((s) => setHQLayout(s, patch)), [updateStore])

  useEffect(() => {
    api
      .store()
      .then((s) => {
        storeRef.current = s
        setStore(s)
      })
      .catch(() => {})
  }, [])

  /* ---------- content loading ---------- */

  const loadContent = useCallback(async (root: string, path: string) => {
    setContentLoading(true)
    try {
      const text = await api.fileText({ root, path })
      const s = selRef.current
      if (s?.kind === 'ws' && s.root === root && s.path === path) setContent(text)
    } catch {
      const s = selRef.current
      if (s?.kind === 'ws' && s.root === root && s.path === path)
        setContent('⚠️ Could not load this file.')
    } finally {
      setContentLoading(false)
    }
  }, [])

  /* ---------- the watched-file index (polling) ---------- */

  const { files, roots, statuses, refresh } = useFileIndex({
    selectedIdRef,
    onNewFile: setNewFile,
    onSelectedChanged: () => {
      const s = selRef.current
      if (s?.kind === 'ws') void loadContent(s.root, s.path)
    },
  })

  /* ---------- preferences effects ---------- */

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(DARK_KEY, dark ? '1' : '0')
  }, [dark])
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedDirs]))
  }, [expandedDirs])
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedRoots]))
  }, [collapsedRoots])

  /* ---------- selection ---------- */

  const selectedId = selectionId(selection)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  // initial selection: last open file, else newest
  useEffect(() => {
    if (selection || files.length === 0) return
    try {
      const last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null') as FileRef | null
      const found = last && files.find((f) => f.id === `${last.root}::${last.path}`)
      if (found) {
        setSelection({ kind: 'ws', root: found.root, path: found.path })
        return
      }
    } catch {
      /* fall through */
    }
    setSelection({ kind: 'ws', root: files[0].root, path: files[0].path })
  }, [files, selection])

  useEffect(() => {
    selRef.current = selection
    if (!selection) return
    setNewFile(null)
    contentScrollRef.current?.scrollTo({ top: 0 })
    if (selection.kind === 'ws') {
      const ref = { root: selection.root, path: selection.path }
      localStorage.setItem(LAST_KEY, JSON.stringify(ref))
      updateStore((s) => pushRecent(s, ref))
      setCollapsedRoots((prev) => {
        if (!prev.has(selection.root)) return prev
        const n = new Set(prev)
        n.delete(selection.root)
        return n
      })
      setExpandedDirs((prev) => {
        const n = new Set(prev)
        const parts = selection.path.split('/')
        for (let i = 1; i < parts.length; i++) n.add(`${selection.root}::${parts.slice(0, i).join('/')}`)
        return n
      })
      void loadContent(selection.root, selection.path)
    } else {
      setContent(dropped[selection.idx]?.content ?? '')
    }
  }, [selection, dropped, loadContent, updateStore])

  const selectFile = useCallback(
    (root: string, path: string) => setSelection({ kind: 'ws', root, path }),
    [],
  )

  /* ---------- roots ---------- */

  const addRoot = useCallback(
    async (path: string): Promise<string | null> => {
      try {
        await api.addRoot(path)
        await refresh()
        return null
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not add that folder'
      }
    },
    [refresh],
  )

  const removeRoot = useCallback(
    async (path: string) => {
      if (!window.confirm(`Stop watching this folder?\n\n${path}`)) return
      try {
        await api.removeRoot(path)
        await refresh()
      } catch {
        /* surfaced on next successful poll */
      }
    },
    [refresh],
  )

  /* ---------- file actions ---------- */

  const wsRef: FileRef | null = selection?.kind === 'ws' ? selection : null

  const onToggleFavorite = useCallback(() => {
    if (wsRef) updateStore((s) => toggleFavorite(s, { root: wsRef.root, path: wsRef.path }))
  }, [wsRef, updateStore])

  const onReveal = useCallback(() => {
    if (!wsRef) return
    api
      .openInOs({ root: wsRef.root, path: wsRef.path })
      .catch((e) => window.alert(e instanceof Error ? e.message : 'Could not reveal file'))
  }, [wsRef])

  const onCopyPath = useCallback(() => {
    if (wsRef) void navigator.clipboard.writeText(`${wsRef.root}/${wsRef.path}`)
  }, [wsRef])

  /* ---------- drag & drop ---------- */

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const picked = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(md|markdown|mdown|txt)$/i.test(f.name),
      )
      if (picked.length === 0) return
      const items = await Promise.all(
        picked.map(async (f) => ({ name: f.name, content: await f.text() })),
      )
      setDropped((prev) => [...prev, ...items])
      setSelection({ kind: 'drop', idx: dropped.length })
    },
    [dropped.length],
  )

  /* ---------- ⌘K ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- derived blocks ---------- */

  const trees = useMemo(() => {
    const perRoot = new Map<string, FileEntry[]>()
    for (const f of files) {
      const arr = perRoot.get(f.root)
      if (arr) arr.push(f)
      else perRoot.set(f.root, [f])
    }
    const m = new Map<string, TreeDir>()
    for (const [r, list] of perRoot) m.set(r, buildTree(list))
    return m
  }, [files])

  const byId = useMemo(() => new Map(files.map((f) => [f.id, f])), [files])
  const refId = (r: FileRef) => `${r.root}::${r.path}`
  const resolveRefs = useCallback(
    (refs: FileRef[]) => refs.map((r) => byId.get(refId(r))).filter((f): f is FileEntry => !!f),
    [byId],
  )
  const favorites = useMemo(() => resolveRefs(store.favorites), [resolveRefs, store.favorites])
  const recents = useMemo(() => resolveRefs(store.recents), [resolveRefs, store.recents])
  const favoriteIds = useMemo(() => new Set(store.favorites.map(refId)), [store.favorites])

  const q = search.trim().toLowerCase()
  const searchMatches = useMemo(() => {
    if (!q) return []
    return files
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.path.toLowerCase().includes(q) ||
          f.root.toLowerCase().includes(q),
      )
      .slice(0, 100)
  }, [files, q])

  const HQ_TITLES: Partial<Record<View, string>> = {
    tasks: 'Tasks',
    board: 'Board',
    timeline: 'Timeline',
    projects: 'Projects',
  }
  const HQ_STORE_FILE: Partial<Record<View, string>> = {
    board: 'tasks.jsonl',
    timeline: 'timeline.jsonl',
    projects: 'projects.jsonl',
  }
  const hqTitle = HQ_TITLES[view]
  const title =
    hqTitle ??
    (selection?.kind === 'ws'
      ? baseName(selection.path)
      : selection?.kind === 'drop'
        ? dropped[selection.idx]?.name
        : 'Novakai Docs')
  const subtitle =
    hqTitle !== undefined
      ? (HQ_STORE_FILE[view] ? `HQ · data/${HQ_STORE_FILE[view]}` : '')
      : selection?.kind === 'ws'
        ? `${rootName(selection.root)} · ${selection.path}`
        : selection?.kind === 'drop'
          ? 'dropped file — not saved anywhere'
          : ''

  useEffect(() => {
    document.title = selection || hqTitle ? `${title} — Novakai Docs` : 'Novakai Docs'
  }, [title, selection, hqTitle])

  const now = Date.now()

  /* ---------- layout ---------- */

  return (
    <div
      className="relative h-screen overflow-hidden bg-background text-foreground"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={(e) => void onDrop(e)}
    >
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={loadLayout()}
        onLayoutChange={(layout) => localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))}
        className="h-full"
      >
        <ResizablePanel
          id="sidebar"
          panelRef={panelRef}
          collapsible
          collapsedSize={0}
          defaultSize="24%"
          minSize="15%"
          maxSize="45%"
          onResize={(size) => setSidebarCollapsed(size.asPercentage <= 0.5)}
          className="bg-muted/30"
        >
          <Sidebar
            roots={roots}
            statuses={statuses}
            trees={trees}
            selectedId={selectedId}
            onSelectFile={(f) => selectFile(f.root, f.path)}
            dropped={dropped}
            selectedDropIdx={selection?.kind === 'drop' ? selection.idx : null}
            onSelectDropped={(idx) => setSelection({ kind: 'drop', idx })}
            favorites={favorites}
            recents={recents}
            favoriteIds={favoriteIds}
            expandedDirs={expandedDirs}
            onToggleDir={(key) =>
              setExpandedDirs((prev) => {
                const n = new Set(prev)
                if (n.has(key)) n.delete(key)
                else n.add(key)
                return n
              })
            }
            collapsedRoots={collapsedRoots}
            onToggleRoot={(root) =>
              setCollapsedRoots((prev) => {
                const n = new Set(prev)
                if (n.has(root)) n.delete(root)
                else n.add(root)
                return n
              })
            }
            onRemoveRoot={(path) => void removeRoot(path)}
            onAddRoot={addRoot}
            search={search}
            onSearch={setSearch}
            searchMatches={searchMatches}
            onOpenPalette={() => setPaletteOpen(true)}
            totalFiles={files.length}
            now={now}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel id="main" defaultSize="76%" minSize="30%">
          <div className="flex h-full flex-col">
            <TopBar
              title={title}
              subtitle={subtitle}
              isFile={view === 'docs' && selection?.kind === 'ws'}
              view={view}
              onViewChange={setView}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => {
                if (sidebarCollapsed) panelRef.current?.expand()
                else panelRef.current?.collapse()
              }}
              raw={raw}
              onToggleRaw={() => setRaw((r) => !r)}
              refreshing={contentLoading}
              onRefresh={() => void refresh()}
              dark={dark}
              onToggleDark={() => setDark((d) => !d)}
              isFavorite={!!wsRef && isFavorite(store, { root: wsRef.root, path: wsRef.path })}
              onToggleFavorite={onToggleFavorite}
              onReveal={onReveal}
              onCopyPath={onCopyPath}
            />

            {newFile && (
              <div className="flex items-center gap-2 border-b bg-emerald-500/10 px-4 py-2 text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 flex-1 truncate">
                  New file:{' '}
                  <button
                    className="font-medium underline underline-offset-2"
                    onClick={() => selectFile(newFile.root, newFile.path)}
                  >
                    {rootName(newFile.root)}/{newFile.path}
                  </button>
                </span>
                <button onClick={() => setNewFile(null)} className="shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div ref={contentScrollRef} className="flex-1 overflow-y-auto">
              {view === 'tasks' ? (
                <TasksTab roots={roots} />
              ) : view === 'board' ? (
                <HQBoard layout={store.hqLayout} onLayout={onHQLayout} />
              ) : view === 'timeline' ? (
                <HQTimeline />
              ) : view === 'projects' ? (
                <HQProjects layout={store.hqLayout} onLayout={onHQLayout} />
              ) : selection ? (
                <MarkdownView
                  content={content}
                  raw={raw}
                  selection={selection}
                  onNavigate={selectFile}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Upload className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-lg font-medium">Drop any .md file here</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    …or press ⌘K to quick-open any file from your watched folders.
                  </p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <QuickOpen
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        files={files}
        favoriteIds={favoriteIds}
        onSelect={(f) => selectFile(f.root, f.path)}
        now={now}
      />

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary px-16 py-12">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Drop to open</p>
            <p className="text-sm text-muted-foreground">.md, .markdown, .txt</p>
          </div>
        </div>
      )}
    </div>
  )
}
