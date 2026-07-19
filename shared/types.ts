/**
 * shared/types.ts — every JSON block that crosses the wire, defined once.
 * Client and server both import from here. No code, only shapes.
 */

/** A folder the docs server watches for markdown. */
export interface RootInfo {
  /** Absolute path on disk. */
  path: string
  /** Display name (basename of path). */
  name: string
}

/** One physical location of a document (worktree copies share content). */
export interface FileCopy {
  root: string
  /** POSIX path relative to root. */
  path: string
  mtime: number
}

/** A logical document: unique content at one or more physical locations. */
export interface FileEntry {
  /** `${root}::${path}` of the primary (most recently modified) copy. */
  id: string
  root: string
  path: string
  name: string
  mtime: number
  size: number
  /** All known locations, newest first. Length > 1 means worktree duplicates. */
  copies: FileCopy[]
}

/** Per-root scan outcome. Failures surface here — never a silently empty root. */
export interface RootStatus {
  path: string
  name: string
  fileCount: number
  /** Non-null when the root could not be scanned. */
  error: string | null
}

/** GET /api/files — the full deduplicated index. */
export interface FilesIndex {
  files: FileEntry[]
  roots: RootStatus[]
  /** Physical files found before dedup. */
  total: number
  /** True when the scan hit the file cap. */
  truncated: boolean
  generatedAt: number
}

/** GET /api/roots — watched folders. */
export interface RootsList {
  roots: RootInfo[]
}

/** POST /api/roots — watch a new folder. */
export interface AddRootRequest {
  path: string
}

/** POST /api/open — reveal a file in the OS file manager. */
export interface OpenRequest {
  root: string
  path: string
}

/** A pointer to one document. Used for favorites and recents. */
export interface FileRef {
  root: string
  path: string
}

/** HQ view layout preferences. Optional everywhere — backward compatible. */
export interface HQLayout {
  /** Board column widths in px, keyed by column id (todo/doing/done). */
  boardColumnWidths?: Record<string, number>
  /** Inspector panel width in px. */
  inspectorWidth?: number
  /** Whether the inspector panel is open. */
  inspectorOpen?: boolean
}

/** User-curated state. Persisted as one JSON block on disk. */
export interface StoreData {
  favorites: FileRef[]
  recents: FileRef[]
  /** HQ view layout; absent in stores written before HQ existed. */
  hqLayout?: HQLayout
}

/** Every non-2xx response body. Always a reason, never a fake empty result. */
export interface ApiError {
  error: string
}

/** One task in a root's task list. */
export interface Task {
  id: string
  title: string
  status: 'todo' | 'done'
  notes?: string
  /** ISO timestamp of creation. */
  created: string
  /** ISO timestamp of the last change. */
  updated: string
}

/** A root's task list. Persisted as tasks.json inside the root. */
export interface TasksData {
  version: 1
  tasks: Task[]
}
