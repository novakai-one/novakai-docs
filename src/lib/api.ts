/**
 * src/lib/api.ts — the typed client SDK for the docs server.
 * Every endpoint returns a shared JSON block (shared/types.ts).
 * UI components never call fetch directly.
 */
import { API, fileUrl, hqBlockUrl, hqReorderUrl, hqUrl, removeRootUrl, tasksUrl, taskUrl } from '../../shared/api'
import type { HQBlock, HQStoreData, HQStoreName, NewBlockInput } from '../../shared/hq'
import type { ApiError, FileRef, FilesIndex, RootsList, StoreData, Task, TasksData } from '../../shared/types'

async function parseError(res: Response): Promise<never> {
  let message = `HTTP ${res.status}`
  try {
    const body = (await res.json()) as Partial<ApiError>
    if (body.error) message = body.error
  } catch {
    /* keep the status-based message */
  }
  throw new Error(message)
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return parseError(res)
  return (await res.json()) as T
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) return parseError(res)
  return (await res.json()) as T
}

export const api = {
  roots: () => get<RootsList>(API.roots),
  files: () => get<FilesIndex>(API.files),
  fileText: async (ref: FileRef): Promise<string> => {
    const res = await fetch(fileUrl(ref.root, ref.path), { cache: 'no-store' })
    if (!res.ok) return parseError(res)
    return res.text()
  },
  addRoot: (path: string) => send<RootsList>(API.roots, 'POST', { path }),
  removeRoot: (path: string) => send<RootsList>(removeRootUrl(path), 'DELETE'),
  store: () => get<StoreData>(API.store),
  putStore: (data: StoreData) => send<StoreData>(API.store, 'PUT', data),
  openInOs: (ref: FileRef) => send<{ ok: boolean }>(API.open, 'POST', ref),
  tasks: (root: string) => get<TasksData>(tasksUrl(root)),
  addTask: (root: string, title: string) => send<TasksData>(tasksUrl(root), 'POST', { title }),
  patchTask: (root: string, id: string, patch: Partial<Pick<Task, 'title' | 'status' | 'notes'>>) =>
    send<TasksData>(taskUrl(root, id), 'PATCH', patch),
  removeTask: (root: string, id: string) => send<TasksData>(taskUrl(root, id), 'DELETE'),
  hq: (store: HQStoreName) => get<HQStoreData>(hqUrl(store)),
  hqCreate: (store: HQStoreName, input: NewBlockInput) => send<HQBlock>(hqUrl(store), 'POST', input),
  hqPatch: (store: HQStoreName, id: string, patch: Record<string, unknown>) =>
    send<HQBlock>(hqBlockUrl(store, id), 'PATCH', patch),
  hqRemove: (store: HQStoreName, id: string) => send<HQBlock>(hqBlockUrl(store, id), 'DELETE'),
  hqReorder: (store: HQStoreName, ids: string[]) =>
    send<HQStoreData>(hqReorderUrl(store), 'POST', { ids }),
}
