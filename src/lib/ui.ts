/**
 * src/lib/ui.ts — UI-local types (not wire blocks; those live in shared/types.ts).
 */

/** What the main pane is showing: a watched file, or a dropped file. */
export type Selection = { kind: 'ws'; root: string; path: string } | { kind: 'drop'; idx: number }

/** A markdown file the user dragged into the window (not saved anywhere). */
export interface DroppedFile {
  name: string
  content: string
}

/**
 * Which top-level tab the main pane is showing.
 * `docs` and `tasks` are the app's own features; the rest are read-only views
 * over the eight Novakai-Command record stores (`board`→tasks.jsonl,
 * `captains-log`→captains-log.jsonl, `projects`→projects.jsonl).
 */
export type View =
  | 'docs'
  | 'tasks'
  | 'decisions'
  | 'requests'
  | 'missions'
  | 'board'
  | 'captains-log'
  | 'learnings'
  | 'okrs'
  | 'projects'

/** The eight read-only record-store views (a subset of View). */
export type RecordView = Exclude<View, 'docs' | 'tasks'>

/** The eight record-store views, in nav order. */
export const RECORD_VIEWS: readonly RecordView[] = [
  'decisions',
  'requests',
  'missions',
  'board',
  'captains-log',
  'learnings',
  'okrs',
  'projects',
]

/** Stable id for a watched-file selection; null for dropped files. */
export const selectionId = (s: Selection | null): string | null =>
  s?.kind === 'ws' ? `${s.root}::${s.path}` : null
