/**
 * src/components/hq/HQTimeline.tsx — reverse-chronological log over the
 * timeline store, grouped under day headers. Ref chips color each kind by
 * a deterministic hash, so newly invented kinds get their own hue
 * automatically. The text filter is cheap: title, notes, and refs.
 */
import { useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import type { HQBlock } from '../../../shared/hq'
import {
  collectRefKinds,
  groupByDay,
  matchesFilter,
  timeLabel,
} from '../../lib/hqView'
import { cn } from '@/lib/utils'
import { useHQStore } from '../../hooks/useHQStore'
import { NOOP, useReadOnlyInspector } from '../../hooks/useReadOnlyInspector'
import { HQInspector } from './HQInspector'
import { HQNotices } from './HQNotices'
import { RefChips } from './RefChips'

const timeOf = (b: HQBlock): string => (typeof b.at === 'string' ? b.at : b.created)

export function HQTimeline() {
  const hq = useHQStore('captains-log')
  const [filter, setFilter] = useState('')

  const blocks = useMemo(() => hq.data?.blocks ?? [], [hq.data])
  const groups = useMemo(() => {
    const filtered = filter.trim() ? blocks.filter((b) => matchesFilter(b, filter)) : blocks
    return groupByDay(filtered, timeOf)
  }, [blocks, filter])
  const kindCount = useMemo(() => collectRefKinds(blocks).length, [blocks])
  const inspector = useReadOnlyInspector(blocks)

  const loading = hq.data === null && hq.loadError === null

  return (
    <div
      className="flex h-full bg-[#0b0b0d] text-[#d7d3cc]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
      <HQNotices
        storeFile="captains-log.jsonl"
        loadError={hq.loadError}
        mutationError={hq.mutationError}
        lineErrors={hq.data?.errors ?? []}
        sourceError={hq.data?.sourceError}
      />

      <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 px-5 pt-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#67656d]" />
          <input
            className="w-full rounded-md border border-[#2a2a2e] bg-[#121214] py-1.5 pl-8 pr-3 text-sm text-[#f1efec] outline-none transition-colors duration-150 placeholder:text-[#67656d] focus:border-[#d7a842]/60"
            value={filter}
            placeholder="Filter titles, notes, refs…"
            aria-label="Filter timeline"
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {kindCount > 0 && (
          <span
            className="shrink-0 text-[10px] text-[#67656d]"
            title="Distinct ref kinds in use — the chips color each one by a hash of its name"
          >
            {kindCount} ref {kindCount === 1 ? 'kind' : 'kinds'} in use
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#8c8b91]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline…
            </div>
          ) : groups.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8c8b91]">
              {filter.trim() ? 'Nothing matches that filter.' : 'No blocks yet — they land here as they happen.'}
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="mb-7">
                <h2 className="mb-2.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[#67656d]">
                  {g.label}
                </h2>
                <ol className="space-y-1.5">
                  {g.blocks.map((b) => {
                    const t = Date.parse(timeOf(b))
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => inspector.select(b.id)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-md border bg-[#121214] px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-[#171719]',
                            inspector.selectedId === b.id
                              ? 'border-[#d7a842]/50 bg-[#232225]'
                              : 'border-[#2a2a2e]',
                          )}
                        >
                          <span className="w-11 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-[#8c8b91]">
                            {Number.isNaN(t) ? '—' : timeLabel(new Date(t))}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-5 text-[#f1efec]">{b.title}</p>
                            {(b.refs ?? []).length > 0 && (
                              <div className="mt-1.5">
                                <RefChips refs={b.refs} />
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))
          )}
        </div>
      </div>
      </div>

      {inspector.block && (
        <HQInspector
          block={inspector.block}
          open={inspector.open}
          width={inspector.width}
          pending={false}
          statuses={[]}
          refKinds={[]}
          readOnly
          onResize={inspector.resize}
          onClose={inspector.close}
          onPatch={NOOP}
          onDelete={NOOP}
        />
      )}
    </div>
  )
}
