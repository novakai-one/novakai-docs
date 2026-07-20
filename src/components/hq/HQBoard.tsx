/**
 * src/components/hq/HQBoard.tsx — kanban over the tasks store.
 * Three columns (todo/doing/done) by exact status match; unknown statuses
 * render in todo and are counted honestly in the header. Native HTML5 DnD:
 * drag between columns (PATCH status) and within a column (POST reorder).
 * Column widths drag-resize and persist in StoreData.hqLayout.
 */
import { useMemo, useRef, useState } from 'react'
import { Archive, Loader2, Plus } from 'lucide-react'
import type { HQBlock } from '../../../shared/hq'
import { moveBlock, patchBlock } from '../../../shared/hq'
import type { HQLayout } from '../../../shared/types'
import { api } from '../../lib/api'
import {
  BOARD_COLUMNS,
  bucketByStatus,
  collectRefKinds,
  collectStatuses,
  type BoardColumn,
} from '../../lib/hqView'
import { cn } from '@/lib/utils'
import { useHQStore } from '../../hooks/useHQStore'
import { useHQInspector } from '../../hooks/useHQInspector'
import { HQInspector } from './HQInspector'
import { HQNotices } from './HQNotices'
import { RefChips } from './RefChips'

export interface HQBoardProps {
  layout: HQLayout | undefined
  onLayout: (patch: Partial<HQLayout>) => void
}

const COLUMN_LABEL: Record<BoardColumn, string> = { todo: 'Todo', doing: 'Doing', done: 'Done' }
const DEFAULT_WIDTH = 300
const MIN_WIDTH = 220

interface DropTarget {
  column: BoardColumn
  /** Insert before this block id; null = end of column. */
  beforeId: string | null
}

export function HQBoard({ layout, onLayout }: HQBoardProps) {
  const hq = useHQStore('tasks')
  const inspector = useHQInspector('tasks', hq, layout, onLayout)
  const [draft, setDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const blocks = useMemo(() => hq.data?.blocks ?? [], [hq.data])
  // Default to read-only until the server says otherwise — never expose writes
  // to the system of record on an unproven payload.
  const readOnly = hq.data?.readOnly ?? true
  // Refile tombstones are historical redirects, not actionable work: keep them
  // out of the active columns and show them in a separate archive strip.
  const active = useMemo(() => blocks.filter((b) => b.status !== 'refiled'), [blocks])
  const refiled = useMemo(() => blocks.filter((b) => b.status === 'refiled'), [blocks])
  const buckets = useMemo(() => bucketByStatus(active), [active])
  const refKinds = useMemo(() => collectRefKinds(blocks), [blocks])
  const statuses = useMemo(
    () => [...new Set([...BOARD_COLUMNS, ...collectStatuses(blocks)])].sort(),
    [blocks],
  )

  /* ---------- column widths (drag-resizable, persisted) ---------- */

  const widths: Record<BoardColumn, number> = {
    todo: layout?.boardColumnWidths?.todo ?? DEFAULT_WIDTH,
    doing: layout?.boardColumnWidths?.doing ?? DEFAULT_WIDTH,
    done: layout?.boardColumnWidths?.done ?? DEFAULT_WIDTH,
  }
  const [colDrag, setColDrag] = useState<{ column: BoardColumn; width: number } | null>(null)
  const colDragState = useRef<{ column: BoardColumn; startX: number; startWidth: number } | null>(null)
  const widthFor = (c: BoardColumn) => (colDrag?.column === c ? colDrag.width : widths[c])

  const onColPointerDown = (column: BoardColumn) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    colDragState.current = { column, startX: e.clientX, startWidth: widthFor(column) }
    setColDrag({ column, width: widthFor(column) })
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onColPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = colDragState.current
    if (!d) return
    setColDrag({ column: d.column, width: Math.max(MIN_WIDTH, d.startWidth + (e.clientX - d.startX)) })
  }
  const onColPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = colDragState.current
    if (!d) return
    colDragState.current = null
    const w = Math.max(MIN_WIDTH, d.startWidth + (e.clientX - d.startX))
    setColDrag(null)
    if (Math.round(w) !== widths[d.column])
      onLayout({ boardColumnWidths: { ...layout?.boardColumnWidths, [d.column]: Math.round(w) } })
  }

  /* ---------- quick add ---------- */

  const onAdd = () => {
    const title = draft.trim()
    if (!title || hq.pending) return
    setDraft('')
    void hq.mutate(() => api.hqCreate('tasks', { title, kind: 'task', status: 'todo' }))
  }

  /* ---------- drag & drop ---------- */

  const bucketOf = (b: HQBlock): BoardColumn =>
    b.status === 'doing' ? 'doing' : b.status === 'done' ? 'done' : 'todo'

  const clearDrag = () => {
    setDragId(null)
    setDropTarget(null)
  }

  const onCardDragOver = (column: BoardColumn, id: string) => (e: React.DragEvent) => {
    if (!dragId || dragId === id) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const beforeId = e.clientY < rect.top + rect.height / 2 ? id : null
    if (!beforeId) {
      // bottom half → after this card = before the next card in the column
      const col = buckets.columns[column]
      const idx = col.findIndex((b) => b.id === id)
      const next = col[idx + 1]
      setDropTarget({ column, beforeId: next ? next.id : null })
    } else {
      setDropTarget({ column, beforeId })
    }
  }

  const onColumnDragOver = (column: BoardColumn) => (e: React.DragEvent) => {
    if (!dragId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget((t) => (t?.column === column && t.beforeId === null ? t : { column, beforeId: null }))
  }

  const onDrop = (column: BoardColumn) => (e: React.DragEvent) => {
    e.preventDefault()
    const id = dragId ?? e.dataTransfer.getData('text/hq-block')
    const target = dropTarget
    clearDrag()
    if (!id || !target || target.column !== column) return
    const dragged = blocks.find((b) => b.id === id)
    if (!dragged) return

    const newStatus = bucketOf(dragged) !== column ? column : null
    let next = newStatus ? patchBlock(blocks, id, { status: newStatus }) : [...blocks]
    const without = next.filter((b) => b.id !== id)
    const toIndex = target.beforeId ? without.findIndex((b) => b.id === target.beforeId) : without.length
    next = moveBlock(next, id, toIndex < 0 ? without.length : toIndex)

    const unchangedOrder = next.every((b, i) => b.id === blocks[i]?.id)
    if (!newStatus && unchangedOrder) return

    const ids = next.map((b) => b.id)
    void hq.mutate(
      async () => {
        if (newStatus) await api.hqPatch('tasks', id, { status: newStatus })
        await api.hqReorder('tasks', ids)
      },
      () => next,
    )
  }

  /* ---------- render ---------- */

  const loading = hq.data === null && hq.loadError === null

  return (
    <div
      className="flex h-full bg-[#0b0b0d] text-[#d7d3cc]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <HQNotices
          storeFile="tasks.jsonl"
          loadError={hq.loadError}
          mutationError={hq.mutationError}
          lineErrors={hq.data?.errors ?? []}
          sourceError={hq.data?.sourceError}
        />

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#8c8b91]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 gap-4 overflow-x-auto p-5">
            {BOARD_COLUMNS.map((column) => {
              const cards = buckets.columns[column]
              return (
                <section
                  key={column}
                  className="flex shrink-0 flex-col rounded-lg border border-[#2a2a2e] bg-[#121214]"
                  style={{ width: widthFor(column) }}
                  aria-label={`${COLUMN_LABEL[column]} column`}
                >
                  <header className="flex h-10 shrink-0 items-center gap-2 border-b border-[#2a2a2e] px-3.5">
                    <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#67656d]">
                      {COLUMN_LABEL[column]}
                    </span>
                    <span className="rounded-full bg-[#171719] px-1.5 py-0.5 text-[10px] leading-3 text-[#8c8b91]">
                      {cards.length}
                    </span>
                    {column === 'todo' && buckets.unknownStatusCount > 0 && (
                      <span
                        className="truncate text-[10px] text-[#8c8b91]"
                        title="Blocks with a status other than todo/doing/done render here"
                      >
                        · {buckets.unknownStatusCount} with other{' '}
                        {buckets.unknownStatusCount === 1 ? 'status' : 'statuses'}
                      </span>
                    )}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${COLUMN_LABEL[column]} column`}
                      className="ml-auto -mr-2 h-5 w-2 shrink-0 cursor-col-resize rounded transition-colors duration-150 hover:bg-[#d7a842]/40"
                      onPointerDown={onColPointerDown(column)}
                      onPointerMove={onColPointerMove}
                      onPointerUp={onColPointerUp}
                    />
                  </header>

                  {column === 'todo' && !readOnly && (
                    <form
                      className="flex shrink-0 gap-1.5 border-b border-[#2a2a2e] p-2.5"
                      onSubmit={(e) => {
                        e.preventDefault()
                        onAdd()
                      }}
                    >
                      <input
                        className="min-w-0 flex-1 rounded-md border border-[#2a2a2e] bg-[#0b0b0d] px-2.5 py-1.5 text-sm text-[#f1efec] outline-none transition-colors duration-150 placeholder:text-[#67656d] focus:border-[#d7a842]/60"
                        value={draft}
                        placeholder="Add a task…"
                        aria-label="New task title"
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={!draft.trim() || hq.pending}
                        className="shrink-0 rounded-md border border-[#d7a842]/50 px-2 text-[#d7a842] transition-colors duration-150 hover:bg-[#d7a842]/10 hover:text-[#e4ae40] disabled:cursor-not-allowed disabled:border-[#2a2a2e] disabled:text-[#67656d]"
                        title="Add task"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </form>
                  )}

                  <div
                    className="flex-1 space-y-2 overflow-y-auto p-2.5"
                    onDragOver={onColumnDragOver(column)}
                    onDrop={onDrop(column)}
                  >
                    {cards.length === 0 && (
                      <p className="px-1 py-6 text-center text-xs text-[#67656d]">
                        {column === 'todo' && !readOnly ? 'No blocks yet — add one above.' : 'Nothing here yet.'}
                      </p>
                    )}
                    {cards.map((b) => (
                      <div key={b.id}>
                        {dropTarget?.column === column && dropTarget.beforeId === b.id && (
                          <div className="mb-2 h-0.5 rounded-full bg-[#d7a842]" />
                        )}
                        <article
                          draggable={!readOnly}
                          onDragStart={(e) => {
                            if (readOnly) return
                            e.dataTransfer.setData('text/hq-block', b.id)
                            e.dataTransfer.effectAllowed = 'move'
                            setDragId(b.id)
                          }}
                          onDragEnd={clearDrag}
                          onDragOver={readOnly ? undefined : onCardDragOver(column, b.id)}
                          onClick={() => inspector.select(b.id)}
                          className={cn(
                            'rounded-md border border-[#2a2a2e] bg-[#171719] p-3 transition-all duration-150 hover:border-[#3a3a3f] hover:bg-[#1c1c1f]',
                            readOnly ? 'cursor-pointer' : 'cursor-grab',
                            dragId === b.id && 'opacity-40',
                            inspector.selectedId === b.id && 'border-[#d7a842]/50 bg-[#232225]',
                          )}
                        >
                          <p
                            className="truncate text-sm leading-5 text-[#f1efec]"
                            title={b.title}
                          >
                            {b.title}
                          </p>
                          {b.status !== undefined &&
                            b.status !== column &&
                            bucketOf(b) === column && (
                              <p className="mt-0.5 text-[10px] italic text-[#8c8b91]">
                                status: {b.status}
                              </p>
                            )}
                          {(b.refs ?? []).length > 0 && (
                            <div className="mt-2">
                              <RefChips refs={b.refs} />
                            </div>
                          )}
                        </article>
                      </div>
                    ))}
                    {dropTarget?.column === column && dropTarget.beforeId === null && cards.length > 0 && (
                      <div className="h-0.5 rounded-full bg-[#d7a842]" />
                    )}
                  </div>
                </section>
              )
            })}
          </div>

          {refiled.length > 0 && (
            <div className="shrink-0 border-t border-[#2a2a2e] px-5 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Archive className="h-3 w-3 text-[#67656d]" />
                <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#67656d]">
                  Refiled
                </span>
                <span className="rounded-full bg-[#171719] px-1.5 py-0.5 text-[10px] leading-3 text-[#8c8b91]">
                  {refiled.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {refiled.map((b) => {
                  const to = typeof b.refiledTo === 'string' ? b.refiledTo : null
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => inspector.select(b.id)}
                      title={to ? `Refiled → ${to}` : b.title}
                      className={cn(
                        'flex max-w-full items-center gap-1.5 rounded-md border border-[#2a2a2e] bg-[#121214] px-2 py-1 text-left transition-colors duration-150 hover:border-[#3a3a3f] hover:bg-[#171719]',
                        inspector.selectedId === b.id && 'border-[#d7a842]/50 bg-[#232225]',
                      )}
                    >
                      <span className="truncate text-[11px] text-[#8c8b91] line-through">{b.title}</span>
                      {to && <span className="shrink-0 font-mono text-[10px] text-[#67656d]">→ {to}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {inspector.block && (
        <HQInspector
          block={inspector.block}
          open={inspector.open}
          width={inspector.width}
          pending={hq.pending}
          statuses={statuses}
          refKinds={refKinds}
          readOnly={readOnly}
          onResize={inspector.resize}
          onClose={inspector.close}
          onPatch={inspector.patch}
          onDelete={inspector.remove}
        />
      )}
    </div>
  )
}
