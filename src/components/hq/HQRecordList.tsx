/**
 * src/components/hq/HQRecordList.tsx — the ONE shallow reusable read-only list
 * over a record store. Renders title + optional body + a meta row (status,
 * owner, timestamp) + open-world ref chips. `groupByStatus` groups cards under
 * status headers (missions); otherwise cards are a flat reverse-chronological
 * list (decisions). Read-only by construction: no mutate paths, no inspector.
 */
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import type { HQBlock, HQStoreName } from '../../../shared/hq'
import { cn } from '@/lib/utils'
import { useHQStore } from '../../hooks/useHQStore'
import { NOOP, useReadOnlyInspector } from '../../hooks/useReadOnlyInspector'
import { HQInspector } from './HQInspector'
import { HQNotices } from './HQNotices'
import { RefChips } from './RefChips'

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** Sort key: prefer the record's own `ts`, else updated, else created. */
const tsOf = (b: HQBlock): string => str(b.ts) ?? b.updated ?? b.created

/** "2026-07-20 09:42" — local, compact, locale-independent. */
function stamp(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export interface HQRecordListProps {
  store: HQStoreName
  storeFile: string
  /** Group cards under status headers (missions) instead of a flat list. */
  groupByStatus?: boolean
  emptyLabel?: string
}

function Card({ b, selected, onClick }: { b: HQBlock; selected: boolean; onClick: () => void }) {
  const body = str(b.body)
  const owner = str(b.owner)
  const priority = str(b.priority)
  const when = stamp(tsOf(b))
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border bg-[#121214] p-4 text-left transition-colors duration-150 hover:border-[#3a3a3f] hover:bg-[#171719]',
        selected ? 'border-[#d7a842]/50 bg-[#232225]' : 'border-[#2a2a2e]',
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#f1efec]">{b.title}</p>
        {b.status !== undefined && (
          <span className="shrink-0 rounded-full border border-[#2a2a2e] px-1.5 py-0.5 text-[10px] leading-3 text-[#8c8b91]">
            {b.status}
          </span>
        )}
      </div>
      {body && (
        <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-[#d7d3cc]">{body}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#67656d]">
        <span className="font-mono">{b.id}</span>
        {owner && <span>owner: {owner}</span>}
        {priority && <span>priority: {priority}</span>}
        {when && <span className="tabular-nums">{when}</span>}
      </div>
      {(b.refs ?? []).length > 0 && (
        <div className="mt-2">
          <RefChips refs={b.refs} />
        </div>
      )}
    </button>
  )
}

export function HQRecordList({ store, storeFile, groupByStatus, emptyLabel }: HQRecordListProps) {
  const hq = useHQStore(store)
  const blocks = useMemo(() => hq.data?.blocks ?? [], [hq.data])

  const sorted = useMemo(
    () => [...blocks].sort((a, b) => Date.parse(tsOf(b)) - Date.parse(tsOf(a)) || 0),
    [blocks],
  )

  const groups = useMemo(() => {
    if (!groupByStatus) return null
    const byStatus = new Map<string, HQBlock[]>()
    for (const b of sorted) {
      const key = b.status ?? '—'
      const arr = byStatus.get(key)
      if (arr) arr.push(b)
      else byStatus.set(key, [b])
    }
    return [...byStatus.entries()]
  }, [sorted, groupByStatus])

  const inspector = useReadOnlyInspector(blocks)
  const loading = hq.data === null && hq.loadError === null

  return (
    <div
      className="flex h-full bg-[#0b0b0d] text-[#d7d3cc]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
      <HQNotices
        storeFile={storeFile}
        loadError={hq.loadError}
        mutationError={hq.mutationError}
        lineErrors={hq.data?.errors ?? []}
        sourceError={hq.data?.sourceError}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#8c8b91]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : sorted.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8c8b91]">{emptyLabel ?? 'No records yet.'}</p>
          ) : groups ? (
            groups.map(([status, items]) => (
              <section key={status} className="mb-7">
                <h2 className="mb-2.5 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.12em] text-[#67656d]">
                  {status}
                  <span className="rounded-full bg-[#171719] px-1.5 py-0.5 text-[10px] leading-3 text-[#8c8b91]">
                    {items.length}
                  </span>
                </h2>
                <div className="space-y-2.5">
                  {items.map((b) => (
                    <Card
                      key={b.id}
                      b={b}
                      selected={inspector.selectedId === b.id}
                      onClick={() => inspector.select(b.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="space-y-2.5">
              {sorted.map((b) => (
                <Card
                  key={b.id}
                  b={b}
                  selected={inspector.selectedId === b.id}
                  onClick={() => inspector.select(b.id)}
                />
              ))}
            </div>
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
