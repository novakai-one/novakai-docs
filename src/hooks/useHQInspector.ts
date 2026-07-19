/**
 * src/hooks/useHQInspector.ts — selection + persistence for the HQ inspector
 * panel, shared by the Board and Projects views. Open/width persist through
 * StoreData.hqLayout; mutations go through the store's optimistic mutate.
 */
import { useState } from 'react'
import type { HQBlock, HQStoreName } from '../../shared/hq'
import { patchBlock, removeBlock } from '../../shared/hq'
import type { HQLayout } from '../../shared/types'
import { api } from '../lib/api'
import type { UseHQStore } from './useHQStore'

export const INSPECTOR_MIN_WIDTH = 260
export const INSPECTOR_MAX_WIDTH = 560

export interface UseHQInspector {
  /** The selected block, or null. Follows external edits via the poll. */
  block: HQBlock | null
  open: boolean
  width: number
  selectedId: string | null
  select: (id: string | null) => void
  close: () => void
  patch: (patch: Record<string, unknown>) => void
  remove: () => void
  resize: (width: number) => void
}

export function useHQInspector(
  store: HQStoreName,
  hq: UseHQStore,
  layout: HQLayout | undefined,
  onLayout: (patch: Partial<HQLayout>) => void,
): UseHQInspector {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const blocks = hq.data?.blocks
  // If the selected block was deleted elsewhere, block is null and the panel
  // hides itself; the stale id matches nothing and needs no cleanup effect.
  const block = selectedId ? (blocks?.find((b) => b.id === selectedId) ?? null) : null

  const open = (layout?.inspectorOpen ?? false) && block !== null
  const width = Math.min(
    INSPECTOR_MAX_WIDTH,
    Math.max(INSPECTOR_MIN_WIDTH, layout?.inspectorWidth ?? 340),
  )

  const select = (id: string | null) => {
    setSelectedId(id)
    if (id && !(layout?.inspectorOpen ?? false)) onLayout({ inspectorOpen: true })
  }

  const close = () => onLayout({ inspectorOpen: false })

  const patch = (p: Record<string, unknown>) => {
    if (!selectedId) return
    const id = selectedId
    void hq.mutate(
      () => api.hqPatch(store, id, p),
      (bs) => patchBlock(bs, id, p),
    )
  }

  const remove = () => {
    if (!selectedId) return
    const id = selectedId
    setSelectedId(null)
    void hq.mutate(
      () => api.hqRemove(store, id),
      (bs) => removeBlock(bs, id),
    )
  }

  const resize = (w: number) =>
    onLayout({
      inspectorWidth: Math.round(Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, w))),
    })

  return { block, open, width, selectedId, select, close, patch, remove, resize }
}
