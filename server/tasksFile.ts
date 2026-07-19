/**
 * server/tasksFile.ts — TasksData on disk (tasks.json inside each watched root).
 * fs edge; the operations on the block itself live in shared/tasks.ts (pure).
 * Plain writeFileSync, matching storeFile.ts — no tmp+rename in this codebase.
 */
import fs from 'node:fs'
import type { Task, TasksData } from '../shared/types'
import { EMPTY_TASKS } from '../shared/tasks'

export const TASKS_FILE = 'tasks.json'

const isTask = (x: unknown): x is Task => {
  if (typeof x !== 'object' || x === null) return false
  const t = x as Task
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    (t.status === 'todo' || t.status === 'done') &&
    typeof t.created === 'string' &&
    typeof t.updated === 'string' &&
    (t.notes === undefined || typeof t.notes === 'string')
  )
}

/** Type guard: is this a well-formed TasksData block? */
export function isTasksData(x: unknown): x is TasksData {
  if (typeof x !== 'object' || x === null) return false
  const d = x as TasksData
  return d.version === 1 && Array.isArray(d.tasks) && d.tasks.every(isTask)
}

/** Missing or corrupt file → empty block, never a throw. */
export function loadTasks(file: string): TasksData {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown
    if (isTasksData(j)) return j
  } catch {
    /* no tasks yet */
  }
  return { ...EMPTY_TASKS, tasks: [] }
}

export function saveTasks(file: string, data: TasksData): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
