import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isTasksData, loadTasks, saveTasks } from './tasksFile'

let tmp = ''
let file = ''

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novakai-docs-tasks-'))
  file = path.join(tmp, 'tasks.json')
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

const sample = {
  version: 1 as const,
  tasks: [
    {
      id: 'a',
      title: 'first',
      status: 'todo' as const,
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    },
  ],
}

describe('tasksFile (integration, temp files)', () => {
  it('returns an empty block when the file does not exist', () => {
    expect(loadTasks(file)).toEqual({ version: 1, tasks: [] })
  })

  it('round-trips a saved block', () => {
    saveTasks(file, sample)
    expect(loadTasks(file)).toEqual(sample)
  })

  it('falls back to empty on malformed JSON', () => {
    fs.writeFileSync(file, '{not json')
    expect(loadTasks(file)).toEqual({ version: 1, tasks: [] })
  })

  it('falls back to empty on a wrong-shaped block', () => {
    fs.writeFileSync(file, JSON.stringify({ version: 2, tasks: [] }))
    expect(loadTasks(file)).toEqual({ version: 1, tasks: [] })
  })

  it('rejects wrong shapes via the type guard', () => {
    expect(isTasksData(sample)).toBe(true)
    expect(isTasksData({ version: 1, tasks: [{ id: 'a' }] })).toBe(false)
    expect(isTasksData({ version: 1, tasks: [{ ...sample.tasks[0], status: 'later' }] })).toBe(false)
    expect(isTasksData('nope')).toBe(false)
    expect(isTasksData(null)).toBe(false)
  })
})
