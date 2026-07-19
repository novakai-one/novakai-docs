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

/** Which top-level tab the main pane is showing. */
export type View = 'docs' | 'tasks' | 'board' | 'timeline' | 'projects'

/** Stable id for a watched-file selection; null for dropped files. */
export const selectionId = (s: Selection | null): string | null =>
  s?.kind === 'ws' ? `${s.root}::${s.path}` : null
