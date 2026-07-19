/**
 * src/components/TasksTab.tsx — per-root task list (the app's first write view).
 * Fetches and mutates only through the typed SDK (src/lib/api.ts); the server
 * returns the full updated TasksData block after every mutation.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { RootInfo, Task, TasksData } from '../../shared/types'
import { EMPTY_TASKS } from '../../shared/tasks'
import { api } from '../lib/api'

export interface TasksTabProps {
  roots: RootInfo[]
}

export function TasksTab({ roots }: TasksTabProps) {
  const [root, setRoot] = useState('')
  /*
   * One result block per root: loading/error are derived from it, so the
   * fetch effect never calls setState synchronously. A mutation error keeps
   * the last good data on screen and surfaces the reason.
   */
  const [result, setResult] = useState<{ root: string; data: TasksData | null; error: string | null } | null>(
    null,
  )
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const activeRoot = roots.some((r) => r.path === root) ? root : (roots[0]?.path ?? '')
  const loading = !!activeRoot && result?.root !== activeRoot
  const data = (result?.root === activeRoot && result.data) || EMPTY_TASKS
  const error = result?.root === activeRoot ? result.error : null

  useEffect(() => {
    if (!activeRoot) return
    let alive = true
    api
      .tasks(activeRoot)
      .then((d) => {
        if (alive) setResult({ root: activeRoot, data: d, error: null })
      })
      .catch((e) => {
        if (alive)
          setResult({
            root: activeRoot,
            data: null,
            error: e instanceof Error ? e.message : 'Could not load tasks',
          })
      })
    return () => {
      alive = false
    }
  }, [activeRoot])

  const mutate = useCallback(
    (fn: () => Promise<TasksData>) => {
      fn()
        .then((d) => setResult({ root: activeRoot, data: d, error: null }))
        .catch((e) =>
          setResult((r) => ({
            root: activeRoot,
            data: r?.root === activeRoot ? r.data : null,
            error: e instanceof Error ? e.message : 'Could not save tasks',
          })),
        )
    },
    [activeRoot],
  )

  const onAdd = () => {
    const title = draft.trim()
    if (!title || !activeRoot) return
    setDraft('')
    mutate(() => api.addTask(activeRoot, title))
  }

  const onToggle = (t: Task) =>
    mutate(() => api.patchTask(activeRoot, t.id, { status: t.status === 'done' ? 'todo' : 'done' }))

  const onRemove = (t: Task) => {
    if (!window.confirm(`Delete this task?\n\n${t.title}`)) return
    mutate(() => api.removeTask(activeRoot, t.id))
  }

  const startEdit = (t: Task) => {
    setEditingId(t.id)
    setEditDraft(t.title)
  }

  const commitEdit = (t: Task) => {
    setEditingId(null)
    const title = editDraft.trim()
    if (title && title !== t.title) mutate(() => api.patchTask(activeRoot, t.id, { title }))
  }

  if (roots.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Add a watched folder first — tasks live in a root's tasks.json.
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 p-6">
      {roots.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {roots.map((r) => (
            <Button
              key={r.path}
              variant={r.path === activeRoot ? 'secondary' : 'ghost'}
              size="sm"
              title={r.path}
              onClick={() => setRoot(r.path)}
            >
              {r.name}
            </Button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd()
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…"
          aria-label="New task title"
        />
        <Button type="submit" size="icon" title="Add task" disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : data.tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks yet — add one above.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {data.tasks.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 px-3 py-2">
                <Checkbox
                  checked={t.status === 'done'}
                  onCheckedChange={() => onToggle(t)}
                  aria-label={t.status === 'done' ? 'Mark as todo' : 'Mark as done'}
                />
                {editingId === t.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <Input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(t)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => commitEdit(t)}
                      className="h-7"
                    />
                    <Button variant="ghost" size="icon" title="Save" onClick={() => commitEdit(t)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Cancel" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className={cn(
                      'min-w-0 flex-1 truncate text-left text-sm',
                      t.status === 'done' && 'text-muted-foreground line-through',
                    )}
                    title="Click to edit"
                    onClick={() => startEdit(t)}
                  >
                    {t.title}
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete task"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => onRemove(t)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
