#!/usr/bin/env node
/**
 * electron/dev.mjs — the desktop dev loop (no new runtime deps):
 *   1. bundle the main process (esbuild, already here via vite)
 *   2. spawn the vite dev server and read its URL from stdout
 *   3. launch Electron with NOVAKAI_HQ_DEV_URL pointing at it (HMR in the shell)
 * Everything is killed when Electron exits or on Ctrl-C — no orphan processes.
 * (The main process itself falls back to the dist server when the dev URL
 * does not answer, so the shell never strands you on a blank page.)
 */
import { spawn, spawnSync } from 'node:child_process'

const bin = (name) => (process.platform === 'win32' ? `${name}.cmd` : name)
const children = new Set()

function run(cmd, args, opts = {}) {
  const child = spawn(bin(cmd), args, { stdio: 'inherit', ...opts })
  children.add(child)
  child.on('exit', () => children.delete(child))
  return child
}

function cleanup() {
  for (const child of children) child.kill('SIGTERM')
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(143)
})
process.on('exit', cleanup)

/* 1. main-process bundle */
const build = spawnSync(
  bin('esbuild'),
  [
    'electron/main.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--external:electron',
    '--outfile=dist-electron/main.cjs',
  ],
  { stdio: 'inherit' },
)
if (build.status !== 0) process.exit(build.status ?? 1)

/* 2. vite dev server — parse the printed URL (port may shift if 7100 is busy) */
const vite = spawn(bin('vite'), [], { stdio: ['inherit', 'pipe', 'inherit'] })
children.add(vite)
vite.on('exit', () => children.delete(vite))

const devUrl = await new Promise((resolve) => {
  let buffer = ''
  const timer = setTimeout(() => resolve(null), 30000)
  vite.stdout.on('data', (chunk) => {
    process.stdout.write(chunk)
    buffer += chunk
    const match = buffer.match(/Local:\s+(https?:\/\/\S+)/i)
    if (match) {
      clearTimeout(timer)
      resolve(match[1].replace(/\/$/, ''))
    }
  })
  vite.on('exit', () => {
    clearTimeout(timer)
    resolve(null)
  })
})

if (!devUrl) {
  console.error('\nCould not determine the vite dev URL — is the dev server healthy?')
  cleanup()
  process.exit(1)
}

/* 3. wait until it actually answers, then launch Electron */
let up = false
for (let i = 0; i < 120 && !up; i++) {
  try {
    const res = await fetch(devUrl)
    up = res.ok
  } catch {
    await new Promise((r) => setTimeout(r, 250))
  }
}
if (!up) {
  console.error(`\nDev server at ${devUrl} never answered — not launching Electron.`)
  cleanup()
  process.exit(1)
}

const electron = run('electron', ['.'], {
  env: { ...process.env, NOVAKAI_HQ_DEV_URL: devUrl },
})
electron.on('exit', (code) => {
  cleanup()
  process.exit(code ?? 0)
})
