/**
 * server/middleware.ts — the HTTP edge. Translates requests into calls on
 * the pure/small modules and shapes responses with the shared JSON blocks.
 *
 * Composable: a plain connect-style (req, res, next) handler. Mount it in
 * Vite (see plugin.ts), Express, or a bare node server — no Vite types here.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type http from 'node:http'
import { API } from '../shared/api'
import { isHQStoreName, newBlock, patchBlock, removeBlock, type HQBlock, type HQStoreData } from '../shared/hq'
import type {
  AddRootRequest,
  ApiError,
  FilesIndex,
  OpenRequest,
  RootInfo,
  RootsList,
  StoreData,
  Task,
  TasksData,
} from '../shared/types'
import { addTask, editTask, removeTask, setStatus } from '../shared/tasks'
import { defaultRoots, expandHome, loadRoots, ROOTS_CONFIG_FILE, saveRoots } from './config'
import { dedupFiles } from './dedup'
import { createHashCache } from './hashing'
import { HQ_DIR, loadHQStore, saveHQStore } from './hqFile'
import { MD_RE, scanRoot } from './scanner'
import type { RawFile } from './scanner'
import { isStoreData, loadStore, saveStore, STORE_FILE } from './storeFile'
import { loadTasks, saveTasks, TASKS_FILE } from './tasksFile'

export interface MdApiDeps {
  /** Project directory; config files and default-root resolution anchor here. */
  appDir: string
  /** Override the initial roots (defaults: parent of appDir + ~/Programming). */
  roots?: string[]
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
}

type Req = http.IncomingMessage
type Res = http.ServerResponse
type Next = () => void

function sendJson(res: Res, code: number, data: unknown): void {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function sendError(res: Res, code: number, error: string): void {
  sendJson(res, code, { error } satisfies ApiError)
}

function readBody(req: Req): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => resolve(body))
    req.on('error', () => resolve(''))
  })
}

/** Reveal a file in the OS file manager. Best effort per platform. */
function revealInOs(abs: string): string | null {
  if (process.platform === 'darwin') {
    spawn('open', ['-R', abs], { detached: true, stdio: 'ignore' }).unref()
    return null
  }
  if (process.platform === 'win32') {
    spawn('explorer', [`/select,${abs}`], { detached: true, stdio: 'ignore' }).unref()
    return null
  }
  if (process.platform === 'linux') {
    spawn('xdg-open', [path.dirname(abs)], { detached: true, stdio: 'ignore' }).unref()
    return null
  }
  return `unsupported platform: ${process.platform}`
}

export function createMdApiMiddleware(deps: MdApiDeps) {
  const configFile = path.join(deps.appDir, ROOTS_CONFIG_FILE)
  const storeFile = path.join(deps.appDir, STORE_FILE)
  const hqDir = path.join(deps.appDir, HQ_DIR)
  let roots = deps.roots ?? loadRoots(configFile, defaultRoots(deps.appDir))
  const hashCache = createHashCache()

  const rootInfo = (): RootInfo[] =>
    roots.map((r) => ({ path: r, name: path.basename(r) || r }))

  const sendRoots = (res: Res) => sendJson(res, 200, { roots: rootInfo() } satisfies RootsList)

  /** Resolve rel under a *registered* root; refuse escapes and unknown roots. */
  const safeResolve = (root: string, rel: string): string | null => {
    if (!root || !rel || !roots.includes(root)) return null
    const abs = path.resolve(root, rel)
    if (abs !== root && !abs.startsWith(root + path.sep)) return null
    return abs
  }

  const buildIndex = (): FilesIndex => {
    const raw: RawFile[] = []
    const statuses: FilesIndex['roots'] = []
    for (const r of roots) {
      const before = raw.length
      const { error } = scanRoot(r, raw, { appDir: deps.appDir })
      statuses.push({
        path: r,
        name: path.basename(r) || r,
        fileCount: raw.length - before,
        error,
      })
    }
    return {
      files: dedupFiles(raw, hashCache.hashFor),
      roots: statuses,
      total: raw.length,
      truncated: raw.length >= 8000,
      generatedAt: Date.now(),
    }
  }

  return function mdApiMiddleware(req: Req, res: Res, next: Next): void {
    const url = new URL(req.url || '/', 'http://localhost')
    const pathname = url.pathname

    if (pathname === API.roots && req.method === 'GET') {
      sendRoots(res)
      return
    }

    if (pathname === API.roots && req.method === 'POST') {
      void readBody(req).then((body) => {
        try {
          const { path: p } = JSON.parse(body || '{}') as Partial<AddRootRequest>
          if (typeof p !== 'string' || !p.trim()) {
            sendError(res, 400, 'missing path')
            return
          }
          const abs = path.resolve(expandHome(p.trim()))
          if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
            sendError(res, 400, `Not a folder: ${abs}`)
            return
          }
          if (!roots.includes(abs)) {
            roots = [...roots, abs]
            saveRoots(configFile, roots)
          }
          sendRoots(res)
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    if (pathname === API.roots && req.method === 'DELETE') {
      const p = url.searchParams.get('path') || ''
      roots = roots.filter((r) => r !== p)
      saveRoots(configFile, roots)
      sendRoots(res)
      return
    }

    if (pathname === API.files && req.method === 'GET') {
      try {
        sendJson(res, 200, buildIndex())
      } catch (err) {
        sendError(res, 500, String(err))
      }
      return
    }

    if (pathname === API.file && req.method === 'GET') {
      const abs = safeResolve(url.searchParams.get('root') || '', url.searchParams.get('path') || '')
      if (!abs || !MD_RE.test(abs) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        sendError(res, 400, 'invalid path')
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(fs.readFileSync(abs, 'utf-8'))
      return
    }

    if (pathname === API.raw && req.method === 'GET') {
      const abs = safeResolve(url.searchParams.get('root') || '', url.searchParams.get('path') || '')
      const mime = abs ? MIME[path.extname(abs).toLowerCase()] : undefined
      if (!abs || !mime || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        sendError(res, 404, 'not found')
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', mime)
      res.setHeader('Cache-Control', 'no-cache')
      fs.createReadStream(abs).pipe(res)
      return
    }

    if (pathname === API.store && req.method === 'GET') {
      sendJson(res, 200, loadStore(storeFile) satisfies StoreData)
      return
    }

    if (pathname === API.store && req.method === 'PUT') {
      void readBody(req).then((body) => {
        try {
          const data = JSON.parse(body || '{}') as unknown
          if (!isStoreData(data)) {
            sendError(res, 400, 'expected { favorites: FileRef[], recents: FileRef[] }')
            return
          }
          saveStore(storeFile, data)
          sendJson(res, 200, data satisfies StoreData)
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    /** Tasks live in tasks.json inside a *registered* root; unknown roots are refused. */
    const taskFile = (): { root: string; file: string } | null => {
      const root = url.searchParams.get('root') || ''
      return roots.includes(root) ? { root, file: path.join(root, TASKS_FILE) } : null
    }

    if (pathname === API.tasks && req.method === 'GET') {
      const t = taskFile()
      if (!t) {
        sendError(res, 400, 'unknown root')
        return
      }
      sendJson(res, 200, loadTasks(t.file) satisfies TasksData)
      return
    }

    if (pathname === API.tasks && req.method === 'POST') {
      void readBody(req).then((body) => {
        try {
          const t = taskFile()
          if (!t) {
            sendError(res, 400, 'unknown root')
            return
          }
          const { title } = JSON.parse(body || '{}') as { title?: unknown }
          if (typeof title !== 'string' || !title.trim()) {
            sendError(res, 400, 'missing title')
            return
          }
          const next = addTask(loadTasks(t.file), title)
          saveTasks(t.file, next)
          sendJson(res, 200, next satisfies TasksData)
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    if (pathname.startsWith(`${API.tasks}/`) && (req.method === 'PATCH' || req.method === 'DELETE')) {
      void readBody(req).then((body) => {
        try {
          const t = taskFile()
          if (!t) {
            sendError(res, 400, 'unknown root')
            return
          }
          const id = decodeURIComponent(pathname.slice(API.tasks.length + 1))
          const data = loadTasks(t.file)
          if (!data.tasks.some((task) => task.id === id)) {
            sendError(res, 404, 'task not found')
            return
          }
          let next: TasksData
          if (req.method === 'DELETE') {
            next = removeTask(data, id)
          } else {
            const patch = JSON.parse(body || '{}') as Partial<Pick<Task, 'title' | 'status' | 'notes'>>
            next = data
            if (patch.status === 'todo' || patch.status === 'done') next = setStatus(next, id, patch.status)
            if (typeof patch.title === 'string' && patch.title.trim())
              next = editTask(next, id, { title: patch.title.trim() })
            if (typeof patch.notes === 'string') next = editTask(next, id, { notes: patch.notes })
            if (next === data) {
              sendError(res, 400, 'nothing to patch')
              return
            }
          }
          saveTasks(t.file, next)
          sendJson(res, 200, next satisfies TasksData)
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    /**
     * HQ typed-block stores (data/<store>.jsonl). The store name is validated
     * against the six known names — anything else is a 400, never a file access.
     */
    const hqStore = () => {
      const s = url.searchParams.get('store') || ''
      return isHQStoreName(s) ? s : null
    }

    if (pathname === API.hq && req.method === 'GET') {
      const store = hqStore()
      if (!store) {
        sendError(res, 400, 'unknown store')
        return
      }
      try {
        sendJson(res, 200, loadHQStore(hqDir, store) satisfies HQStoreData)
      } catch (err) {
        sendError(res, 500, String(err))
      }
      return
    }

    if (pathname === API.hq && req.method === 'POST') {
      void readBody(req).then((body) => {
        try {
          const store = hqStore()
          if (!store) {
            sendError(res, 400, 'unknown store')
            return
          }
          const input = JSON.parse(body || '{}') as Record<string, unknown>
          if (typeof input.title !== 'string' || !input.title.trim()) {
            sendError(res, 400, 'missing title')
            return
          }
          const data = loadHQStore(hqDir, store)
          const created = newBlock({ ...input, title: input.title, kind: input.kind ?? store } as Parameters<
            typeof newBlock
          >[0])
          saveHQStore(hqDir, store, [...data.blocks, created])
          sendJson(res, 200, created satisfies HQBlock)
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    if (pathname === `${API.hq}/reorder` && req.method === 'POST') {
      void readBody(req).then((body) => {
        try {
          const store = hqStore()
          if (!store) {
            sendError(res, 400, 'unknown store')
            return
          }
          const { ids } = JSON.parse(body || '{}') as { ids?: unknown }
          if (!Array.isArray(ids) || !ids.every((i) => typeof i === 'string')) {
            sendError(res, 400, 'expected { ids: string[] }')
            return
          }
          const data = loadHQStore(hqDir, store)
          const rank = new Map((ids as string[]).map((id, i) => [id, i]))
          const ordered = [...data.blocks].sort(
            (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
          )
          saveHQStore(hqDir, store, ordered)
          sendJson(res, 200, { ...data, blocks: ordered, generatedAt: Date.now() } satisfies HQStoreData)
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    if (pathname.startsWith(`${API.hq}/`) && (req.method === 'PATCH' || req.method === 'DELETE')) {
      void readBody(req).then((body) => {
        try {
          const store = hqStore()
          if (!store) {
            sendError(res, 400, 'unknown store')
            return
          }
          const id = decodeURIComponent(pathname.slice(API.hq.length + 1))
          const data = loadHQStore(hqDir, store)
          const existing = data.blocks.find((b) => b.id === id)
          if (!existing) {
            sendError(res, 404, 'block not found')
            return
          }
          if (req.method === 'DELETE') {
            saveHQStore(hqDir, store, removeBlock(data.blocks, id))
            sendJson(res, 200, existing satisfies HQBlock)
            return
          }
          const patch = JSON.parse(body || '{}') as Record<string, unknown>
          const next = patchBlock(data.blocks, id, patch)
          if (next.every((b, i) => b === data.blocks[i])) {
            sendError(res, 400, 'nothing to patch')
            return
          }
          saveHQStore(hqDir, store, next)
          const updated = next.find((b) => b.id === id)
          if (!updated) {
            sendError(res, 500, 'patch lost the block')
            return
          }
          sendJson(res, 200, updated satisfies HQBlock)
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    if (pathname === API.open && req.method === 'POST') {
      void readBody(req).then((body) => {
        try {
          const { root, path: rel } = JSON.parse(body || '{}') as Partial<OpenRequest>
          const abs = safeResolve(typeof root === 'string' ? root : '', typeof rel === 'string' ? rel : '')
          if (!abs || !fs.existsSync(abs)) {
            sendError(res, 400, 'invalid path')
            return
          }
          const problem = revealInOs(abs)
          if (problem) sendError(res, 400, problem)
          else sendJson(res, 200, { ok: true })
        } catch {
          sendError(res, 400, 'bad request')
        }
      })
      return
    }

    next()
  }
}
