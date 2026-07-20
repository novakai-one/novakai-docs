/**
 * src/components/hq/HQLearnings.tsx — retro findings over learnings.jsonl.
 * A learning is a body plus an `evidence` ref array (a log entry or mission);
 * per the store contract a learning without evidence is an opinion, so a
 * missing evidence array is flagged rather than hidden. Read-only.
 */
import { useMemo } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { HQBlock, Ref } from '../../../shared/hq'
import { kindHue } from '../../lib/hqView'
import { cn } from '@/lib/utils'
import { useHQStore } from '../../hooks/useHQStore'
import { NOOP, useReadOnlyInspector } from '../../hooks/useReadOnlyInspector'
import { HQInspector } from './HQInspector'
import { HQNotices } from './HQNotices'

const isRef = (x: unknown): x is Ref =>
  typeof x === 'object' && x !== null && typeof (x as Ref).kind === 'string' && typeof (x as Ref).value === 'string'

const evidenceOf = (b: HQBlock): Ref[] => (Array.isArray(b.evidence) ? b.evidence.filter(isRef) : [])

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

export function HQLearnings() {
  const hq = useHQStore('learnings')
  const blocks = useMemo(() => hq.data?.blocks ?? [], [hq.data])
  const sorted = useMemo(
    () => [...blocks].sort((a, b) => Date.parse(b.created) - Date.parse(a.created) || 0),
    [blocks],
  )

  const inspector = useReadOnlyInspector(blocks)
  const loading = hq.data === null && hq.loadError === null

  return (
    <div
      className="flex h-full bg-[#0b0b0d] text-[#d7d3cc]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
      <HQNotices
        storeFile="learnings.jsonl"
        loadError={hq.loadError}
        mutationError={hq.mutationError}
        lineErrors={hq.data?.errors ?? []}
        sourceError={hq.data?.sourceError}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#8c8b91]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading learnings…
            </div>
          ) : sorted.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8c8b91]">No learnings filed yet.</p>
          ) : (
            <div className="space-y-3">
              {sorted.map((b) => {
                const evidence = evidenceOf(b)
                const body = str(b.body) ?? b.title
                const selected = inspector.selectedId === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => inspector.select(b.id)}
                    className={cn(
                      'w-full rounded-lg border bg-[#121214] p-4 text-left transition-colors duration-150 hover:bg-[#171719]',
                      selected ? 'border-[#d7a842]/50 bg-[#232225]' : 'border-[#2a2a2e]',
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#f1efec]">{body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#67656d]">
                        Evidence
                      </span>
                      {evidence.length > 0 ? (
                        evidence.map((r, i) => (
                          <span
                            key={`${r.kind}:${r.value}:${i}`}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#2a2a2e] bg-[#171719] px-1.5 py-0.5 text-[11px] leading-4"
                            title={`${r.kind}: ${r.value}`}
                          >
                            <span className="shrink-0 font-medium" style={{ color: `hsl(${kindHue(r.kind)} 55% 68%)` }}>
                              {r.kind}
                            </span>
                            <span className="min-w-0 truncate text-[#d7d3cc]">{r.value}</span>
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#d7a842]">
                          <AlertTriangle className="h-3 w-3" /> no evidence — opinion
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
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
