/**
 * src/components/hq/HQInspector.tsx — the right-side inspector panel shared
 * by the Board and Projects views. Edits commit on blur through the parent's
 * optimistic mutate; refs are open-world chips — the kind input is free text
 * with a datalist of previously-used kinds, never a hardcoded select.
 *
 * The outer wrapper animates open/close with a width transition (~300ms);
 * the left-edge handle drag-resizes live with transitions disabled.
 */
import { useRef, useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import type { HQBlock } from '../../../shared/hq'
import { addRef, removeRef } from '../../../shared/hq'
import { cn } from '@/lib/utils'
import { RefChips } from './RefChips'

export interface HQInspectorProps {
  block: HQBlock
  open: boolean
  width: number
  pending: boolean
  /** Suggestions only — both inputs stay free text. */
  statuses: string[]
  refKinds: string[]
  /** Read-only lens over an external store: no edits, no delete, no ref-add. */
  readOnly?: boolean
  onResize: (width: number) => void
  onClose: () => void
  onPatch: (patch: Record<string, unknown>) => void
  onDelete: () => void
}

const inputCls =
  'w-full rounded-md border border-[#2a2a2e] bg-[#0b0b0d] px-2.5 py-1.5 text-sm text-[#f1efec] outline-none transition-colors duration-150 placeholder:text-[#67656d] focus:border-[#d7a842]/60'

const labelCls = 'text-[9px] font-medium uppercase tracking-[0.12em] text-[#67656d]'

export function HQInspector(p: HQInspectorProps) {
  /*
   * Drafts are derived state, keyed to the block version (id + updated):
   * no effects, no remounts. Typing survives polls; an external edit (new
   * `updated`) resets the drafts honestly; our own commits change the key,
   * which makes the just-committed draft stale — and it is simply ignored.
   */
  const version = `${p.block.id}:${p.block.updated}`
  const [drafts, setDrafts] = useState<{ key: string; title: string; status: string; notes: string } | null>(
    null,
  )
  const d = drafts?.key === version ? drafts : null
  const title = d?.title ?? p.block.title
  const status = d?.status ?? p.block.status ?? ''
  const notes = d?.notes ?? p.block.notes ?? ''
  const setDraft = (field: 'title' | 'status' | 'notes', value: string) =>
    setDrafts({
      key: version,
      title: field === 'title' ? value : title,
      status: field === 'status' ? value : status,
      notes: field === 'notes' ? value : notes,
    })

  const [refKind, setRefKind] = useState('')
  const [refValue, setRefValue] = useState('')
  const [refLabel, setRefLabel] = useState('')

  /* ---- left-edge drag resize (live local, commit on pointerup) ---- */
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)
  const shown = dragWidth ?? p.width

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startWidth: shown }
    setDragWidth(shown)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d) return
    setDragWidth(Math.max(260, Math.min(560, d.startWidth + (d.startX - e.clientX))))
  }
  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d) return
    dragState.current = null
    const w = Math.max(260, Math.min(560, d.startWidth + (d.startX - e.clientX)))
    setDragWidth(null)
    if (Math.round(w) !== p.width) p.onResize(w)
  }

  const commitTitle = () => {
    const t = title.trim()
    if (t && t !== p.block.title) p.onPatch({ title: t })
    else setDraft('title', p.block.title)
  }
  const commitStatus = () => {
    const s = status.trim()
    if (s !== (p.block.status ?? '')) p.onPatch({ status: s ? s : null })
    else setDraft('status', p.block.status ?? '')
  }
  const commitNotes = () => {
    if (notes !== (p.block.notes ?? '')) p.onPatch({ notes: notes ? notes : null })
    else setDraft('notes', p.block.notes ?? '')
  }

  const onAddRef = () => {
    const kind = refKind.trim()
    const value = refValue.trim()
    if (!kind || !value) return
    const label = refLabel.trim()
    const next = addRef(p.block, label ? { kind, value, label } : { kind, value })
    setRefKind('')
    setRefValue('')
    setRefLabel('')
    p.onPatch({ refs: next.refs })
  }

  return (
    <div
      className={cn(
        'h-full shrink-0 overflow-hidden',
        dragWidth === null ? 'transition-[width] duration-300 ease-out' : 'transition-none',
      )}
      style={{ width: p.open ? shown : 0 }}
    >
      <aside
        className="relative flex h-full flex-col border-l border-[#2a2a2e] bg-[#121214]"
        style={{ width: shown }}
        aria-label="Block inspector"
        aria-hidden={!p.open}
      >
        {/* resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div className="mx-auto h-full w-px bg-[#2a2a2e] transition-colors duration-150 hover:bg-[#d7a842]" />
        </div>

        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#2a2a2e] px-4">
          <span className={labelCls}>Inspector</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#8c8b91]" title={p.block.id}>
            {p.block.id}
          </span>
          {p.pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8c8b91]" />}
          <button
            type="button"
            aria-label="Close inspector"
            className="rounded p-1 text-[#8c8b91] transition-colors duration-150 hover:bg-[#171719] hover:text-[#f1efec]"
            onClick={p.onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {p.readOnly ? (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <span className={labelCls}>Title</span>
              <p className="text-sm leading-5 text-[#f1efec]">{p.block.title}</p>
            </div>
            {p.block.status !== undefined && (
              <div className="space-y-1.5">
                <span className={labelCls}>Status</span>
                <p className="text-sm text-[#d7d3cc]">{p.block.status}</p>
              </div>
            )}
            {p.block.notes !== undefined && p.block.notes !== '' && (
              <div className="space-y-1.5">
                <span className={labelCls}>Notes</span>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#d7d3cc]">{p.block.notes}</p>
              </div>
            )}
            {typeof p.block.body === 'string' && p.block.body !== '' && (
              <div className="space-y-1.5">
                <span className={labelCls}>Body</span>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#d7d3cc]">{p.block.body}</p>
              </div>
            )}
            <div className="space-y-2">
              <span className={labelCls}>Refs</span>
              {(p.block.refs ?? []).length > 0 ? (
                <RefChips refs={p.block.refs} />
              ) : (
                <p className="text-xs text-[#8c8b91]">No refs.</p>
              )}
            </div>
          </div>
        ) : (
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="hq-inspector-title">
              Title
            </label>
            <input
              id="hq-inspector-title"
              className={inputCls}
              value={title}
              onChange={(e) => setDraft('title', e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setDraft('title', p.block.title)
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="hq-inspector-status">
              Status
            </label>
            <input
              id="hq-inspector-status"
              className={inputCls}
              value={status}
              list="hq-status-suggestions"
              placeholder="todo"
              onChange={(e) => setDraft('status', e.target.value)}
              onBlur={commitStatus}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setDraft('status', p.block.status ?? '')
              }}
            />
            <datalist id="hq-status-suggestions">
              {p.statuses.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="hq-inspector-notes">
              Notes
            </label>
            <textarea
              id="hq-inspector-notes"
              className={`${inputCls} min-h-28 resize-y leading-relaxed`}
              value={notes}
              placeholder="Plain text…"
              onChange={(e) => setDraft('notes', e.target.value)}
              onBlur={commitNotes}
            />
          </div>

          <div className="space-y-2">
            <span className={labelCls}>Refs</span>
            {(p.block.refs ?? []).length > 0 ? (
              <RefChips refs={p.block.refs} onRemove={(i) => p.onPatch({ refs: removeRef(p.block, i).refs })} />
            ) : (
              <p className="text-xs text-[#8c8b91]">No refs yet.</p>
            )}
            <div className="space-y-1.5 rounded-md border border-[#2a2a2e] bg-[#0b0b0d] p-2">
              <div className="flex gap-1.5">
                <input
                  className={inputCls}
                  style={{ width: '38%' }}
                  value={refKind}
                  list="hq-ref-kind-suggestions"
                  placeholder="kind"
                  aria-label="Ref kind"
                  onChange={(e) => setRefKind(e.target.value)}
                />
                <input
                  className={inputCls}
                  value={refValue}
                  placeholder="value"
                  aria-label="Ref value"
                  onChange={(e) => setRefValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onAddRef()
                  }}
                />
              </div>
              <datalist id="hq-ref-kind-suggestions">
                {p.refKinds.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
              <div className="flex gap-1.5">
                <input
                  className={inputCls}
                  value={refLabel}
                  placeholder="label (optional)"
                  aria-label="Ref label (optional)"
                  onChange={(e) => setRefLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onAddRef()
                  }}
                />
                <button
                  type="button"
                  disabled={!refKind.trim() || !refValue.trim()}
                  className="shrink-0 rounded-md border border-[#d7a842]/50 px-2.5 text-[#d7a842] transition-colors duration-150 hover:bg-[#d7a842]/10 hover:text-[#e4ae40] disabled:cursor-not-allowed disabled:border-[#2a2a2e] disabled:text-[#67656d]"
                  onClick={onAddRef}
                  title="Add ref"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

        {!p.readOnly && (
        <div className="shrink-0 border-t border-[#2a2a2e] p-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#2a2a2e] px-3 py-1.5 text-sm text-[#d7d3cc] transition-colors duration-150 hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300"
            onClick={() => {
              if (window.confirm(`Delete this block?\n\n${p.block.title}`)) p.onDelete()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete block
          </button>
        </div>
        )}
      </aside>
    </div>
  )
}
