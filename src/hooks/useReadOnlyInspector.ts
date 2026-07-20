/**
 * src/hooks/useReadOnlyInspector.ts — local selection state for the read-only
 * HQInspector, shared by the record views (Log, Decisions, Missions, Requests,
 * Learnings, OKRs). The read-only sibling of useHQInspector: no store identity,
 * no polling/mutation, no persisted layout — just selection + width. `open` is
 * derived from `block !== null`, so `close()` clears the id explicitly.
 */
import { useState } from 'react'
import type { HQBlock } from '../../shared/hq'
import { INSPECTOR_MAX_WIDTH, INSPECTOR_MIN_WIDTH } from './useHQInspector'

/** Shared no-op for HQInspector's required (but unused) mutation callbacks. */
export const NOOP = (): void => {}

export interface UseReadOnlyInspector {
  selectedId: string | null
  /** The selected block, or null. Follows external edits via the poll. */
  block: HQBlock | null
  open: boolean
  width: number
  select: (id: string) => void
  close: () => void
  resize: (width: number) => void
}

export function useReadOnlyInspector(blocks: readonly HQBlock[]): UseReadOnlyInspector {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [width, setWidth] = useState(340)

  // A deleted/absent selection resolves to null; the panel hides itself and the
  // stale id matches nothing on the next poll — no cleanup effect needed.
  const block = selectedId ? (blocks.find((b) => b.id === selectedId) ?? null) : null

  return {
    selectedId,
    block,
    open: block !== null,
    width,
    select: (id: string) => setSelectedId(id),
    close: () => setSelectedId(null),
    resize: (w: number) =>
      setWidth(Math.round(Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, w)))),
  }
}
