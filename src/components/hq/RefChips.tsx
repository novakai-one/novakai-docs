/**
 * src/components/hq/RefChips.tsx — open-world ref chips.
 * Every chip is `kind: value`; the kind is colored by a deterministic hash
 * of the kind string, so newly invented kinds get their own hue
 * automatically — the chips visualize emergence. Doc refs are chips,
 * not links.
 */
import { X } from 'lucide-react'
import type { Ref } from '../../../shared/hq'
import { kindHue } from '../../lib/hqView'
import { cn } from '@/lib/utils'

export interface RefChipProps {
  ref_: Ref
  /** When set, renders a remove button (inspector editing). */
  onRemove?: () => void
}

export function RefChip({ ref_, onRemove }: RefChipProps) {
  const hue = kindHue(ref_.kind)
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#2a2a2e] bg-[#171719] px-1.5 py-0.5 text-[11px] leading-4"
      title={ref_.label ? `${ref_.kind}: ${ref_.value} — ${ref_.label}` : `${ref_.kind}: ${ref_.value}`}
    >
      <span className="shrink-0 font-medium" style={{ color: `hsl(${hue} 55% 68%)` }}>
        {ref_.kind}
      </span>
      <span className="min-w-0 truncate text-[#d7d3cc]">{ref_.value}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ref ${ref_.kind}: ${ref_.value}`}
          className="shrink-0 rounded text-[#8c8b91] transition-colors duration-150 hover:text-[#f1efec]"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export function RefChips({ refs, onRemove }: { refs: Ref[] | undefined; onRemove?: (index: number) => void }) {
  if (!refs || refs.length === 0) return null
  return (
    <span className={cn('flex flex-wrap gap-1', onRemove && 'w-full')}>
      {refs.map((r, i) => (
        <RefChip key={`${r.kind}:${r.value}:${i}`} ref_={r} onRemove={onRemove ? () => onRemove(i) : undefined} />
      ))}
    </span>
  )
}
