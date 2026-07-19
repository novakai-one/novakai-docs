/**
 * src/components/hq/HQProjects.tsx — card grid over the projects store.
 * Title, status badge (amber for active), the `focus` extra field as the
 * body line, path in muted mono, and open-world ref chips. Clicking a card
 * opens the same inspector panel as the Board.
 */
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import type { HQLayout } from '../../../shared/types'
import { collectRefKinds, collectStatuses } from '../../lib/hqView'
import { cn } from '@/lib/utils'
import { useHQStore } from '../../hooks/useHQStore'
import { useHQInspector } from '../../hooks/useHQInspector'
import { HQInspector } from './HQInspector'
import { HQNotices } from './HQNotices'
import { RefChips } from './RefChips'

export interface HQProjectsProps {
  layout: HQLayout | undefined
  onLayout: (patch: Partial<HQLayout>) => void
}

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

export function HQProjects({ layout, onLayout }: HQProjectsProps) {
  const hq = useHQStore('projects')
  const inspector = useHQInspector('projects', hq, layout, onLayout)

  const blocks = useMemo(() => hq.data?.blocks ?? [], [hq.data])
  const refKinds = useMemo(() => collectRefKinds(blocks), [blocks])
  const statuses = useMemo(() => collectStatuses(blocks), [blocks])

  const loading = hq.data === null && hq.loadError === null

  return (
    <div
      className="flex h-full bg-[#0b0b0d] text-[#d7d3cc]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <HQNotices
          storeFile="projects.jsonl"
          loadError={hq.loadError}
          mutationError={hq.mutationError}
          lineErrors={hq.data?.errors ?? []}
        />

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[#8c8b91]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
            </div>
          ) : blocks.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8c8b91]">No blocks yet.</p>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {blocks.map((b) => {
                const focus = asString(b.focus)
                const path = asString(b.path)
                const active = b.status === 'active'
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => inspector.select(b.id)}
                    className={cn(
                      'flex flex-col gap-2 rounded-lg border border-[#2a2a2e] bg-[#121214] p-4 text-left transition-colors duration-150 hover:border-[#3a3a3f] hover:bg-[#171719]',
                      inspector.selectedId === b.id && 'border-[#d7a842]/50 bg-[#232225]',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#f1efec]" title={b.title}>
                        {b.title}
                      </span>
                      {b.status !== undefined && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] leading-3',
                            active
                              ? 'border-[#d7a842]/50 text-[#d7a842]'
                              : 'border-[#2a2a2e] text-[#8c8b91]',
                          )}
                        >
                          {b.status}
                        </span>
                      )}
                    </div>
                    {focus && (
                      <p className="line-clamp-2 text-xs leading-5 text-[#d7d3cc]" title={focus}>
                        {focus}
                      </p>
                    )}
                    {path && (
                      <p className="truncate font-mono text-[11px] text-[#8c8b91]" title={path}>
                        {path}
                      </p>
                    )}
                    {(b.refs ?? []).length > 0 && <RefChips refs={b.refs} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {inspector.block && (
        <HQInspector
          block={inspector.block}
          open={inspector.open}
          width={inspector.width}
          pending={hq.pending}
          statuses={statuses}
          refKinds={refKinds}
          onResize={inspector.resize}
          onClose={inspector.close}
          onPatch={inspector.patch}
          onDelete={inspector.remove}
        />
      )}
    </div>
  )
}
