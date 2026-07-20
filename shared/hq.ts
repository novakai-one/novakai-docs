/**
 * shared/hq.ts — the HQ contract: typed-block JSONL stores + pure ops.
 * One block per line, one store per file (data/<store>.jsonl).
 * Refs and statuses are open-world: kind is a free-form string and views
 * interpret statuses — nothing here assumes a fixed menu.
 * No fs, no fetch: same functions run in the browser and in tests.
 */

export interface Ref {
  kind: string
  value: string
  label?: string
}

export interface HQBlock {
  id: string
  kind: string
  title: string
  status?: string
  notes?: string
  refs?: Ref[]
  created: string
  updated: string
  /** Per-store extra fields, forward-compatible. */
  [extra: string]: unknown
}

/**
 * The eight operating stores of the Novakai-Command system of record
 * (.novakai/stores/<name>.jsonl). novakai-docs is a read-only lens over these;
 * the old sample stores (timeline/experiments/content) are retired.
 */
export type HQStoreName =
  | 'decisions'
  | 'requests'
  | 'missions'
  | 'tasks'
  | 'captains-log'
  | 'learnings'
  | 'okrs'
  | 'projects'

export const HQ_STORE_NAMES: readonly HQStoreName[] = [
  'decisions',
  'requests',
  'missions',
  'tasks',
  'captains-log',
  'learnings',
  'okrs',
  'projects',
]

export interface HQLineError {
  /** 1-based line number in the .jsonl file. */
  line: number
  reason: string
}

/** GET /api/hq — one store's blocks; corrupt lines surface in errors. */
export interface HQStoreData {
  store: HQStoreName
  blocks: HQBlock[]
  errors: HQLineError[]
  generatedAt: number
  /**
   * Provenance (one resolved value shared by server guards and the UI):
   * `external` stores are read-only; `internal` is the app's own writable data/.
   */
  source?: 'internal' | 'external'
  readOnly?: boolean
  /** The directory the store was resolved from — surfaced so the UI can name it. */
  dir?: string
  /**
   * Store-level load failure (missing source dir, unreadable file) — distinct
   * from per-line `errors`. Empty-but-present store has no sourceError.
   */
  sourceError?: string
}

export function isHQStoreName(x: unknown): x is HQStoreName {
  return typeof x === 'string' && (HQ_STORE_NAMES as readonly string[]).includes(x)
}

const isRef = (x: unknown): x is Ref =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as Ref).kind === 'string' &&
  typeof (x as Ref).value === 'string' &&
  ((x as Ref).label === undefined || typeof (x as Ref).label === 'string')

/** Type guard: required HQ block fields present; extras pass through. */
export function isHQBlock(x: unknown): x is HQBlock {
  if (typeof x !== 'object' || x === null) return false
  const b = x as HQBlock
  return (
    typeof b.id === 'string' &&
    b.id.length > 0 &&
    typeof b.kind === 'string' &&
    typeof b.title === 'string' &&
    typeof b.created === 'string' &&
    typeof b.updated === 'string' &&
    (b.status === undefined || typeof b.status === 'string') &&
    (b.notes === undefined || typeof b.notes === 'string') &&
    (b.refs === undefined || (Array.isArray(b.refs) && b.refs.every(isRef)))
  )
}

/** Why a parsed line is not a block — the first broken required field. */
export function blockProblem(x: unknown): string {
  if (typeof x !== 'object' || x === null) return 'not an object'
  const b = x as HQBlock
  if (typeof b.id !== 'string' || b.id.length === 0) return 'missing id'
  if (typeof b.kind !== 'string') return 'missing kind'
  if (typeof b.title !== 'string') return 'missing title'
  if (typeof b.created !== 'string') return 'missing created'
  if (typeof b.updated !== 'string') return 'missing updated'
  if (b.status !== undefined && typeof b.status !== 'string') return 'status is not a string'
  if (b.notes !== undefined && typeof b.notes !== 'string') return 'notes is not a string'
  if (b.refs !== undefined && !(Array.isArray(b.refs) && b.refs.every(isRef)))
    return 'refs is not Ref[]'
  return 'invalid block'
}

/**
 * Parse a .jsonl store. Blank lines are skipped; every bad line is collected
 * with its 1-based line number — never thrown away silently, never thrown.
 */
export function parseHQJsonl(text: string): { blocks: HQBlock[]; errors: HQLineError[] } {
  const blocks: HQBlock[] = []
  const errors: HQLineError[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw) continue
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isHQBlock(parsed)) blocks.push(parsed)
      else errors.push({ line: i + 1, reason: blockProblem(parsed) })
    } catch (e) {
      errors.push({ line: i + 1, reason: `invalid JSON: ${(e as Error).message}` })
    }
  }
  return { blocks, errors }
}

/** Serialize blocks back to .jsonl: one compact JSON block per line. */
export function serializeHQJsonl(blocks: readonly HQBlock[]): string {
  return blocks.map((b) => JSON.stringify(b)).join('\n') + (blocks.length > 0 ? '\n' : '')
}

export interface NewBlockInput {
  title: string
  kind?: string
  status?: string
  notes?: string
  refs?: Ref[]
  /** Per-store extra fields. */
  [extra: string]: unknown
}

/** A fresh block with a unique id and matching created/updated timestamps. */
export function newBlock(input: NewBlockInput): HQBlock {
  const t = new Date().toISOString()
  const { title, kind = 'block', status, notes, refs, ...extras } = input
  return {
    // Extras first: identity and provenance always win over caller input.
    ...extras,
    id: crypto.randomUUID(),
    kind,
    title: title.trim(),
    ...(status !== undefined ? { status } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(refs !== undefined ? { refs } : {}),
    created: t,
    updated: t,
  }
}

/** Fields a patch may never touch. */
const PROTECTED = new Set(['id', 'kind', 'created', 'updated'])

/**
 * Immutable partial update; sets `updated`. Unknown ids are ignored.
 * `id`, `kind`, `created`, `updated` in the patch are dropped — identity
 * and provenance are not patchable. A `null`/`undefined` value deletes the
 * key (how a JSON PATCH clears an optional field like status or notes).
 */
export function patchBlock(
  blocks: readonly HQBlock[],
  id: string,
  patch: Record<string, unknown>,
): HQBlock[] {
  const sets: Record<string, unknown> = {}
  const dels: string[] = []
  for (const [k, v] of Object.entries(patch)) {
    if (PROTECTED.has(k)) continue
    if (v === undefined || v === null) dels.push(k)
    else sets[k] = v
  }
  if (Object.keys(sets).length === 0 && dels.length === 0) return [...blocks]
  const now = new Date().toISOString()
  return blocks.map((b) => {
    if (b.id !== id) return b
    const next: Record<string, unknown> = { ...b, ...sets }
    for (const k of dels) delete next[k]
    return { ...next, updated: now } as HQBlock
  })
}

/** Immutable removal. Unknown ids are ignored. */
export function removeBlock(blocks: readonly HQBlock[], id: string): HQBlock[] {
  return blocks.filter((b) => b.id !== id)
}

/**
 * Move a block to an explicit index in the array (the store's persisted order).
 * Unknown ids and out-of-range indices clamp honestly; nothing is dropped.
 */
export function moveBlock(blocks: readonly HQBlock[], id: string, toIndex: number): HQBlock[] {
  const from = blocks.findIndex((b) => b.id === id)
  if (from < 0) return [...blocks]
  const next = [...blocks]
  const [b] = next.splice(from, 1)
  const clamped = Math.max(0, Math.min(toIndex, next.length))
  next.splice(clamped, 0, b)
  return next
}

/** Append a ref to a block (immutable). */
export function addRef(block: HQBlock, ref: Ref): HQBlock {
  return { ...block, refs: [...(block.refs ?? []), ref] }
}

/** Remove the ref at `index` from a block (immutable). */
export function removeRef(block: HQBlock, index: number): HQBlock {
  const refs = (block.refs ?? []).filter((_, i) => i !== index)
  return refs.length > 0 ? { ...block, refs } : { ...block, refs: [] }
}
