/**
 * shared/hqAdapt.ts — the Adapter seam. Translates the Novakai-Command record
 * contract (id, kind, ts, …) into the viewer's internal `HQBlock` contract on
 * load. PURE: no fs, no fetch — fabricated fixtures in tests, real lines at the
 * data edge (server/hqFile.ts).
 *
 * The record files are the system of record and stay untouched; only their
 * in-memory shape is normalized. The adapter ADDS the required fields
 * (title, created, updated) and passes everything else through as extras, then
 * validates with the canonical `isHQBlock` guard so downstream code past the
 * seam only ever sees valid blocks — the guarantee is checked, not asserted.
 */
import { blockProblem, isHQBlock, type HQBlock, type HQLineError } from './hq'

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** First non-empty line of a body, capped so a paragraph doesn't become a title. */
function firstLine(body: string): string | undefined {
  const line = body.split('\n').map((l) => l.trim()).find((l) => l.length > 0)
  if (!line) return undefined
  return line.length > 120 ? `${line.slice(0, 119)}…` : line
}

export type AdaptResult = { ok: true; block: HQBlock } | { ok: false; error: string }

/**
 * Normalize one record object into an HQBlock, or explain why it can't be.
 *
 * - `id` and `kind` are the record's real invariants — missing either is an error.
 * - Timestamps: `created = created ?? ts ?? updated` (the seven refile tombstones
 *   in tasks.jsonl carry only `updated`); `updated = updated ?? ts ?? created`.
 * - Title fallback: `title ?? question ?? firstLine(body) ?? id` (log/learning/kr
 *   have no title; requests use `question`; tombstones fall through to `id`).
 * - Everything else (body, options, evidence, horizon, intent, objective, owner,
 *   refiledTo, ts, refs, status, notes, …) passes through verbatim as extras.
 */
export function adaptExternalBlock(raw: unknown): AdaptResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'not an object' }
  const r = raw as Record<string, unknown>

  const id = str(r.id)
  if (!id) return { ok: false, error: 'missing id' }
  const kind = str(r.kind)
  if (!kind) return { ok: false, error: 'missing kind' }

  const created = str(r.created) ?? str(r.ts) ?? str(r.updated)
  const updated = str(r.updated) ?? str(r.ts) ?? created
  const body = str(r.body)
  const title = str(r.title) ?? str(r.question) ?? (body ? firstLine(body) : undefined) ?? id

  // Passthrough first, then the normalized required fields win.
  const candidate: Record<string, unknown> = {
    ...r,
    id,
    kind,
    title,
    ...(created !== undefined ? { created } : {}),
    ...(updated !== undefined ? { updated } : {}),
  }

  if (!isHQBlock(candidate)) return { ok: false, error: blockProblem(candidate) }
  return { ok: true, block: candidate }
}

/**
 * Parse an external .jsonl store. Blank lines skipped; every line that is not a
 * valid record is collected with its 1-based line number — never thrown, never
 * silently dropped. Mirrors `parseHQJsonl`'s error contract, but adapts instead
 * of rejecting foreign-but-valid shapes.
 */
export function parseExternalJsonl(text: string): { blocks: HQBlock[]; errors: HQLineError[] } {
  const blocks: HQBlock[] = []
  const errors: HQLineError[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw) continue
    try {
      const parsed: unknown = JSON.parse(raw)
      const res = adaptExternalBlock(parsed)
      if (res.ok) blocks.push(res.block)
      else errors.push({ line: i + 1, reason: res.error })
    } catch (e) {
      errors.push({ line: i + 1, reason: `invalid JSON: ${(e as Error).message}` })
    }
  }
  return { blocks, errors }
}
