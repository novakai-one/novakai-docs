/**
 * src/components/hq/HQOkrs.tsx — objectives + key results over okrs.jsonl.
 * The store mixes two kinds in one file: `objective` (with a `horizon`) and
 * `kr` (with an `objective` ref id and a `body`). This view partitions by kind
 * and nests KRs under their objective — the tree the flat file implies. The
 * split is a view concern, never the adapter's. Read-only.
 */
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import type { HQBlock } from '../../../shared/hq'
import { cn } from '@/lib/utils'
import { useHQStore } from '../../hooks/useHQStore'
import { NOOP, useReadOnlyInspector } from '../../hooks/useReadOnlyInspector'
import { HQInspector } from './HQInspector'
import { HQNotices } from './HQNotices'

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

const HORIZONS: { key: string; label: string }[] = [
  { key: 'now', label: 'Now' },
  { key: 'next', label: 'Next' },
  { key: 'later', label: 'Later' },
]

export function HQOkrs() {
  const hq = useHQStore('okrs')
  const blocks = useMemo(() => hq.data?.blocks ?? [], [hq.data])

  const { objectives, krsByObjective, horizons } = useMemo(() => {
    const objectives = blocks.filter((b) => b.kind === 'objective')
    const krs = blocks.filter((b) => b.kind === 'kr')
    const krsByObjective = new Map<string, HQBlock[]>()
    for (const kr of krs) {
      const oid = str(kr.objective)
      if (!oid) continue
      const arr = krsByObjective.get(oid)
      if (arr) arr.push(kr)
      else krsByObjective.set(oid, [kr])
    }
    // Horizon buckets in declared order, plus any unexpected horizon at the end.
    const seen = new Set(HORIZONS.map((h) => h.key))
    const extra = [...new Set(objectives.map((o) => str(o.horizon)).filter((h): h is string => !!h && !seen.has(h)))]
    const horizons = [...HORIZONS, ...extra.map((k) => ({ key: k, label: k }))]
    return { objectives, krsByObjective, horizons }
  }, [blocks])

  const inspector = useReadOnlyInspector(blocks)
  const loading = hq.data === null && hq.loadError === null

  return (
    <div
      className="flex h-full bg-[#0b0b0d] text-[#d7d3cc]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
      <HQNotices
        storeFile="okrs.jsonl"
        loadError={hq.loadError}
        mutationError={hq.mutationError}
        lineErrors={hq.data?.errors ?? []}
        sourceError={hq.data?.sourceError}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#8c8b91]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading OKRs…
            </div>
          ) : objectives.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8c8b91]">No objectives yet.</p>
          ) : (
            horizons.map((h) => {
              const objs = objectives.filter((o) => str(o.horizon) === h.key)
              if (objs.length === 0) return null
              return (
                <section key={h.key} className="mb-7">
                  <h2 className="mb-2.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[#67656d]">
                    {h.label}
                  </h2>
                  <div className="space-y-3">
                    {objs.map((o) => {
                      const intent = str(o.intent)
                      const krs = krsByObjective.get(o.id) ?? []
                      return (
                        // Plain container: the objective header and each KR are
                        // SIBLING buttons (never nested), so a KR click selects the
                        // KR — it cannot bubble into the objective's own button.
                        <article
                          key={o.id}
                          className={cn(
                            'rounded-lg border bg-[#121214] p-4',
                            inspector.selectedId === o.id ? 'border-[#d7a842]/50' : 'border-[#2a2a2e]',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => inspector.select(o.id)}
                            className={cn(
                              'block w-full rounded-md px-1 py-0.5 text-left transition-colors duration-150 hover:bg-[#171719]',
                              inspector.selectedId === o.id && 'bg-[#232225]',
                            )}
                          >
                            <p className="text-sm font-medium leading-5 text-[#f1efec]">{o.title}</p>
                            {intent && <p className="mt-1 text-xs leading-5 text-[#8c8b91]">{intent}</p>}
                          </button>
                          {krs.length > 0 && (
                            <ul className="mt-3 space-y-1 border-l border-[#2a2a2e] pl-2">
                              {krs.map((kr) => {
                                const done = kr.status === 'done' || kr.status === 'closed'
                                return (
                                  <li key={kr.id}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        inspector.select(kr.id)
                                      }}
                                      className={cn(
                                        'flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-xs leading-5 transition-colors duration-150 hover:bg-[#171719]',
                                        inspector.selectedId === kr.id && 'bg-[#232225]',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                                          done ? 'bg-[#78a886]' : 'bg-[#d7a842]',
                                        )}
                                      />
                                      <span className="min-w-0 flex-1 text-[#d7d3cc]">
                                        {str(kr.body) ?? kr.title}
                                      </span>
                                      {kr.status !== undefined && (
                                        <span className="shrink-0 text-[10px] text-[#67656d]">{kr.status}</span>
                                      )}
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })
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
