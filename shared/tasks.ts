/**
 * shared/tasks.ts — pure operations on the TasksData block.
 * No fs, no fetch: same functions run in the browser and in tests
 * with fabricated fixtures. Deleting (not archiving) keeps the Task
 * shape free of flags — the file holds exactly what the list shows.
 */
import type { Task, TasksData } from './types'

export const EMPTY_TASKS: TasksData = { version: 1, tasks: [] }

const now = (): string => new Date().toISOString()

/** Returns a new TasksData with a fresh todo task prepended. Empty titles are ignored. */
export function addTask(data: TasksData, title: string): TasksData {
  const trimmed = title.trim()
  if (!trimmed) return data
  const t = now()
  const task: Task = { id: crypto.randomUUID(), title: trimmed, status: 'todo', created: t, updated: t }
  return { ...data, tasks: [task, ...data.tasks] }
}

const patchTask = (data: TasksData, id: string, patch: Partial<Omit<Task, 'id' | 'created'>>): TasksData => ({
  ...data,
  tasks: data.tasks.map((t) => (t.id === id ? { ...t, ...patch, updated: now() } : t)),
})

/** Returns a new TasksData with the task's status flipped. Unknown ids are ignored. */
export function setStatus(data: TasksData, id: string, status: Task['status']): TasksData {
  return patchTask(data, id, { status })
}

/** Returns a new TasksData with the task's title/notes replaced. Unknown ids are ignored. */
export function editTask(data: TasksData, id: string, patch: { title?: string; notes?: string }): TasksData {
  return patchTask(data, id, patch)
}

/** Returns a new TasksData with the task removed. Unknown ids are ignored. */
export function removeTask(data: TasksData, id: string): TasksData {
  return { ...data, tasks: data.tasks.filter((t) => t.id !== id) }
}
