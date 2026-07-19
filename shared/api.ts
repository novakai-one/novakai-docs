/**
 * shared/api.ts — the API contract in one place.
 * Server routes on these paths; the client SDK builds URLs with these helpers.
 * One fact, one place (DRY): no hardcoded '/api/...' strings anywhere else.
 */

export const API = {
  roots: '/api/roots',
  files: '/api/files',
  file: '/api/file',
  raw: '/api/raw',
  store: '/api/store',
  open: '/api/open',
  tasks: '/api/tasks',
  hq: '/api/hq',
} as const

const q = encodeURIComponent

/** GET URL for a document's raw markdown text. */
export const fileUrl = (root: string, path: string): string =>
  `${API.file}?root=${q(root)}&path=${q(path)}`

/** GET URL for a binary asset (image) living next to a document. */
export const rawUrl = (root: string, path: string): string =>
  `${API.raw}?root=${q(root)}&path=${q(path)}`

/** DELETE URL for unwatching a root. */
export const removeRootUrl = (path: string): string => `${API.roots}?path=${q(path)}`

/** GET/POST URL for a root's task list. */
export const tasksUrl = (root: string): string => `${API.tasks}?root=${q(root)}`

/** PATCH/DELETE URL for one task in a root's task list. */
export const taskUrl = (root: string, id: string): string =>
  `${API.tasks}/${q(id)}?root=${q(root)}`

/** GET/POST URL for one HQ store (data/<store>.jsonl). */
export const hqUrl = (store: string): string => `${API.hq}?store=${q(store)}`

/** PATCH/DELETE URL for one block in an HQ store. */
export const hqBlockUrl = (store: string, id: string): string =>
  `${API.hq}/${q(id)}?store=${q(store)}`

/** POST URL for persisting an explicit block order in an HQ store. */
export const hqReorderUrl = (store: string): string => `${API.hq}/reorder?store=${q(store)}`
