/**
 * electron/main.ts — the desktop shell, deliberately thin.
 *
 * Starts a loopback node http server on 127.0.0.1 with an ephemeral port
 * that (a) mounts the existing API middleware (server/middleware.ts — the
 * same one the Vite plugin uses) and (b) statically serves dist/. One
 * BrowserWindow loads that loopback URL: one origin, no CORS, no file://
 * quirks, no IPC rewrite of the API.
 *
 * All app logic lives in shared/, server/, src/ — this file is process
 * plumbing only: server, window, bounds persistence, single instance.
 *
 * DATA DIR: the middleware anchors data/ (and the roots/store config files)
 * at appDir = app.getAppPath() — the repo root under `npm run desktop`, so
 * data/ is found exactly like under `npm run dev`. PACKAGED-APP DATA
 * LOCATION IS AN OPEN QUESTION FOR THE OWNER: inside a packaged .app,
 * appDir is read-only resources/app — data/ probably belongs in userData.
 * Not solved here on purpose.
 */
import { app, BrowserWindow, screen } from 'electron'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createMdApiMiddleware } from '../server/middleware'

const APP_NAME = 'Novakai HQ'
const isMac = process.platform === 'darwin'

const DEFAULT_WIDTH = 1440
const DEFAULT_HEIGHT = 900
const MIN_WIDTH = 1024
const MIN_HEIGHT = 700

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const appDir = app.getAppPath()
const distDir = path.join(appDir, 'dist')

/* ---------- loopback server: API middleware + static dist/ ---------- */

function serveStatic(pathname: string, res: http.ServerResponse): void {
  const rel = pathname.replace(/^\/+/, '') || 'index.html'
  const abs = path.resolve(distDir, rel)
  const inside = abs === distDir || abs.startsWith(distDir + path.sep)
  if (inside && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    res.statusCode = 200
    res.setHeader('Content-Type', MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream')
    fs.createReadStream(abs).pipe(res)
    return
  }
  // SPA fallback only for extension-less navigations; missing assets 404.
  if (!path.extname(rel) && fs.existsSync(path.join(distDir, 'index.html'))) {
    res.statusCode = 200
    res.setHeader('Content-Type', MIME['.html'])
    fs.createReadStream(path.join(distDir, 'index.html')).pipe(res)
    return
  }
  res.statusCode = 404
  res.end('not found')
}

async function startServer(): Promise<string> {
  const api = createMdApiMiddleware({ appDir })
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (url.pathname.startsWith('/api/')) {
      api(req, res, () => {
        res.statusCode = 404
        res.end('not found')
      })
      return
    }
    serveStatic(url.pathname, res)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('loopback server has no port')
  app.on('will-quit', () => server.close())
  return `http://127.0.0.1:${address.port}`
}

/**
 * desktop:dev sets NOVAKAI_HQ_DEV_URL (vite, with HMR). When it is set and
 * answers, the window loads it; otherwise we fall back to the built dist
 * server — the shell works either way.
 */
async function resolveUrl(): Promise<string> {
  const devUrl = process.env.NOVAKAI_HQ_DEV_URL
  if (devUrl) {
    try {
      const res = await fetch(devUrl, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return devUrl
    } catch {
      /* dev server not there — fall back to dist */
    }
  }
  return startServer()
}

/* ---------- window bounds persistence (userData) ---------- */

interface Bounds {
  x?: number
  y?: number
  width: number
  height: number
}

const boundsFile = (): string => path.join(app.getPath('userData'), 'window-bounds.json')

function loadBounds(): Bounds {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), 'utf-8')) as Partial<Bounds>
    const width = typeof b.width === 'number' && b.width >= MIN_WIDTH ? b.width : DEFAULT_WIDTH
    const height = typeof b.height === 'number' && b.height >= MIN_HEIGHT ? b.height : DEFAULT_HEIGHT
    if (typeof b.x === 'number' && typeof b.y === 'number') {
      // Keep the position only if it still lands on a connected display.
      const { x, y } = b
      const visible = screen
        .getAllDisplays()
        .some(
          (d) =>
            x >= d.workArea.x &&
            y >= d.workArea.y &&
            x < d.workArea.x + d.workArea.width &&
            y < d.workArea.y + d.workArea.height,
        )
      if (visible) return { x, y, width, height }
    }
    return { width, height }
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  }
}

function saveBounds(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(boundsFile(), JSON.stringify(win.getNormalBounds(), null, 2))
  } catch {
    /* losing window bounds is not an error worth surfacing */
  }
}

/* ---------- window ---------- */

let mainWindow: BrowserWindow | null = null
let startUrl: string | null = null

function createWindow(): void {
  if (!startUrl) return
  const bounds = loadBounds()
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: '#0b0b0d',
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = win
  win.on('close', () => saveBounds(win))
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  void win.loadURL(startUrl)
}

/* ---------- lifecycle: single instance, platform quit convention ---------- */

app.setName(APP_NAME)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })

  void app.whenReady().then(async () => {
    startUrl = await resolveUrl()
    createWindow()
    app.on('activate', () => {
      // macOS convention: clicking the dock icon re-opens the window.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    // macOS convention: the app stays alive without windows.
    if (!isMac) app.quit()
  })
}
