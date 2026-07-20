/**
 * src/components/hq/HQRequests.tsx — Chris's inbox over requests.jsonl.
 * Each card is a question with its explicit options and a pending/answered
 * state. `options` (a string[]) is the one field a generic list would drop, so
 * it gets bespoke rendering here. Read-only.
 */
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import type { HQBlock } from '../../../shared/hq'
import { cn } from '@/lib/utils'
import { useHQStore } from '../../hooks/useHQStore'
import { NOOP, useReadOnlyInspector } from '../../hooks/useReadOnlyInspector'
import { HQInspector } from './HQInspector'
import { HQNotices } from './HQNotices'
import { RefChips } from './RefChips'

const optionsOf = (b: HQBlock): string[] =>
  Array.isArray(b.options) ? b.options.filter((o): o is string => typeof o === 'string') : []

export function HQRequests() {
  const hq = useHQStore('requests')
  const blocks = useMemo(() => hq.data?.blocks ?? [], [hq.data])

  // Pending first (they still need Chris), then answered.
  const sorted = useMemo(
    () =>
      [...blocks].sort((a, b) => {
        const rank = (x: HQBlock) => (x.status === 'pending' ? 0 : 1)
        return rank(a) - rank(b)
      }),
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
        storeFile="requests.jsonl"
        loadError={hq.loadError}
        mutationError={hq.mutationError}
        lineErrors={hq.data?.errors ?? []}
        sourceError={hq.data?.sourceError}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#8c8b91]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
            </div>
          ) : sorted.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8c8b91]">Inbox zero — no open requests.</p>
          ) : (
            <div className="space-y-3">
              {sorted.map((b) => {
                const options = optionsOf(b)
                const answered = b.status === 'answered'
                const selected = inspector.selectedId === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => inspector.select(b.id)}
                    className={cn(
                      'w-full rounded-lg border bg-[#121214] p-4 text-left transition-colors duration-150 hover:bg-[#171719]',
                      selected
                        ? 'border-[#d7a842]/70 bg-[#232225]'
                        : answered
                          ? 'border-[#2a2a2e]'
                          : 'border-[#d7a842]/40',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#f1efec]">{b.title}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] leading-3',
                          answered
                            ? 'border-[#2a2a2e] text-[#78a886]'
                            : 'border-[#d7a842]/50 text-[#d7a842]',
                        )}
                      >
                        {b.status ?? 'pending'}
                      </span>
                    </div>
                    {options.length > 0 && (
                      <ol className="mt-2.5 space-y-1.5">
                        {options.map((o, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-5 text-[#d7d3cc]">
                            <span className="shrink-0 font-mono text-[#67656d]">{i + 1}.</span>
                            <span className="min-w-0">{o}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {(b.refs ?? []).length > 0 && (
                      <div className="mt-2.5">
                        <RefChips refs={b.refs} />
                      </div>
                    )}
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
