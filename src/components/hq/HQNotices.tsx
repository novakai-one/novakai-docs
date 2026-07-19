/**
 * src/components/hq/HQNotices.tsx — honest state banners for the HQ views:
 * load failures, failed mutations (rolled back), and corrupt .jsonl lines.
 */
import { AlertTriangle, CircleAlert } from 'lucide-react'
import type { HQLineError } from '../../../shared/hq'

export interface HQNoticesProps {
  storeFile: string
  loadError: string | null
  mutationError: string | null
  lineErrors: HQLineError[]
}

export function HQNotices({ storeFile, loadError, mutationError, lineErrors }: HQNoticesProps) {
  if (!loadError && !mutationError && lineErrors.length === 0) return null
  const lines = lineErrors.map((e) => e.line).join(', ')
  return (
    <div className="space-y-1.5 px-5 pt-3">
      {loadError && (
        <div className="flex items-center gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate" title={loadError}>
            Could not load {storeFile}: {loadError}
          </span>
        </div>
      )}
      {mutationError && (
        <div className="flex items-center gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate" title={mutationError}>
            Save failed — reverted to the file on disk: {mutationError}
          </span>
        </div>
      )}
      {lineErrors.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-[#d7a842]/30 bg-[#d7a842]/8 px-3 py-2 text-xs text-[#d7a842]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate" title={lineErrors.map((e) => `line ${e.line}: ${e.reason}`).join('\n')}>
            {lineErrors.length} corrupt {lineErrors.length === 1 ? 'line' : 'lines'} in {storeFile} skipped
            (lines {lines}) — fix them on disk; the rest is shown.
          </span>
        </div>
      )}
    </div>
  )
}
