import { describe, expect, it } from 'vitest'
import type { Task, TasksData } from './types'
import { addTask, editTask, EMPTY_TASKS, removeTask, setStatus } from './tasks'

const task = (id: string, title = id, status: Task['status'] = 'todo'): Task => ({
  id,
  title,
  status,
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
})

const data = (tasks: Task[] = []): TasksData => ({ version: 1, tasks })

describe('addTask', () => {
  it('prepends a todo task with timestamps and a unique id', () => {
    const d = addTask(data([task('a')]), 'water the ferns')
    expect(d.tasks).toHaveLength(2)
    const t = d.tasks[0]
    expect(t.title).toBe('water the ferns')
    expect(t.status).toBe('todo')
    expect(t.id).not.toBe('a')
    expect(Date.parse(t.created)).not.toBeNaN()
    expect(t.updated).toBe(t.created)
  })

  it('trims the title and ignores empty ones', () => {
    expect(addTask(data(), '  hi  ').tasks[0].title).toBe('hi')
    expect(addTask(data(), '   ')).toEqual(EMPTY_TASKS)
  })
})

describe('setStatus', () => {
  it('flips the status and bumps updated, leaving other tasks alone', () => {
    const d = setStatus(data([task('a'), task('b')]), 'a', 'done')
    expect(d.tasks[0].status).toBe('done')
    expect(Date.parse(d.tasks[0].updated)).toBeGreaterThan(Date.parse(task('a').updated))
    expect(d.tasks[1]).toEqual(task('b'))
  })

  it('ignores unknown ids', () => {
    const d = data([task('a')])
    expect(setStatus(d, 'nope', 'done')).toEqual(d)
  })
})

describe('editTask', () => {
  it('patches title and notes', () => {
    const d = editTask(data([task('a')]), 'a', { title: 'new', notes: 'n' })
    expect(d.tasks[0].title).toBe('new')
    expect(d.tasks[0].notes).toBe('n')
  })

  it('ignores unknown ids', () => {
    const d = data([task('a')])
    expect(editTask(d, 'nope', { title: 'x' })).toEqual(d)
  })
})

describe('removeTask', () => {
  it('drops the task and keeps the rest', () => {
    const d = removeTask(data([task('a'), task('b')]), 'a')
    expect(d.tasks.map((t) => t.id)).toEqual(['b'])
  })

  it('ignores unknown ids', () => {
    const d = data([task('a')])
    expect(removeTask(d, 'nope')).toEqual(d)
  })
})
