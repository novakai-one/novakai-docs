/**
 * src/lib/hqView.ts — PURE view helpers for the HQ views.
 * No fs, no fetch, no React: fabricated fixtures in tests, real blocks in the UI.
 */
import type { HQBlock } from '../../shared/hq'

export const BOARD_COLUMNS = ['todo', 'doing', 'done'] as const
export type BoardColumn = (typeof BOARD_COLUMNS)[number]

export interface BoardBuckets {
  columns: Record<BoardColumn, HQBlock[]>
  /**
   * Blocks carrying a status outside todo/doing/done. They render in the
   * todo column (statuses are open strings) and the count is surfaced
   * honestly in the column header.
   */
  unknownStatusCount: number
}

/** Bucket blocks by exact status match; unknown/missing statuses land in todo. */
export function bucketByStatus(blocks: readonly HQBlock[]): BoardBuckets {
  const columns: Record<BoardColumn, HQBlock[]> = { todo: [], doing: [], done: [] }
  let unknownStatusCount = 0
  for (const b of blocks) {
    if (b.status === 'doing') columns.doing.push(b)
    else if (b.status === 'done') columns.done.push(b)
    else {
      columns.todo.push(b)
      if (b.status !== undefined && b.status !== 'todo') unknownStatusCount++
    }
  }
  return { columns, unknownStatusCount }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Sun 19 Jul" — local day, locale-independent so tests are stable. */
export function dayLabel(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Day grouping key, local time: YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "14:05" — local wall-clock time. */
export function timeLabel(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export interface DayGroup {
  key: string
  label: string
  blocks: HQBlock[]
}

/**
 * Group blocks under day headers, reverse-chronological. `timeOf` picks the
 * timestamp (timeline blocks carry `at`; fall back to `created`).
 * Blocks with unparseable timestamps sort to the bottom honestly.
 */
export function groupByDay(blocks: readonly HQBlock[], timeOf: (b: HQBlock) => string): DayGroup[] {
  const stamp = (b: HQBlock): number => {
    const t = Date.parse(timeOf(b))
    return Number.isNaN(t) ? 0 : t
  }
  const sorted = [...blocks].sort((a, b) => stamp(b) - stamp(a))
  const groups: DayGroup[] = []
  const byKey = new Map<string, DayGroup>()
  for (const b of sorted) {
    const t = stamp(b)
    const key = t === 0 ? 'unknown' : dayKey(new Date(t))
    let g = byKey.get(key)
    if (!g) {
      g = { key, label: t === 0 ? 'Unknown date' : dayLabel(new Date(t)), blocks: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.blocks.push(b)
  }
  return groups
}

/**
 * Deterministic hue (0–359) for a ref kind. Newly invented kinds get their
 * own hue automatically — the chips visualize emergence.
 */
export function kindHue(kind: string): number {
  let h = 0
  for (let i = 0; i < kind.length; i++) h = (h * 31 + kind.charCodeAt(i)) >>> 0
  return h % 360
}

/** Sorted unique ref kinds across blocks — feeds the free-text datalist. */
export function collectRefKinds(blocks: readonly HQBlock[]): string[] {
  const kinds = new Set<string>()
  for (const b of blocks) for (const r of b.refs ?? []) kinds.add(r.kind)
  return [...kinds].sort()
}

/** Sorted unique statuses across blocks — feeds the free-text datalist. */
export function collectStatuses(blocks: readonly HQBlock[]): string[] {
  const statuses = new Set<string>()
  for (const b of blocks) if (b.status !== undefined) statuses.add(b.status)
  return [...statuses].sort()
}

/**
 * Honest source subtitle for an HQ store view. Uses the payload's resolved `dir`
 * whenever it is known — internal or external, both are the truthful directory —
 * with a trailing slash normalized before the filename. When the source is not
 * yet established it shows a neutral loading/failed state, never an asserted
 * `data/…` path the app can't stand behind.
 */
export function storeSourceSubtitle(
  storeFile: string,
  dir: string | null,
  state: 'loading' | 'ready' | 'error',
): string {
  if (dir) return `${dir.replace(/\/+$/, '')}/${storeFile}`
  if (state === 'loading') return 'Resolving source…'
  return 'Source unavailable'
}

/** Cheap text filter: title, notes, and ref values/kinds. */
export function matchesFilter(b: HQBlock, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (b.title.toLowerCase().includes(needle)) return true
  if (b.notes?.toLowerCase().includes(needle)) return true
  return (b.refs ?? []).some(
    (r) =>
      r.value.toLowerCase().includes(needle) ||
      r.kind.toLowerCase().includes(needle) ||
      (r.label?.toLowerCase().includes(needle) ?? false),
  )
}
