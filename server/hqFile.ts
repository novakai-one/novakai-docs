/**
 * server/hqFile.ts — HQ typed-block stores on disk (data/<store>.jsonl).
 * fs edge; the operations on the blocks themselves live in shared/hq.ts (pure).
 * Saves are atomic: write a tmp file, then rename over the store.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { HQBlock, HQStoreData, HQStoreName } from '../shared/hq'
import { parseHQJsonl, serializeHQJsonl } from '../shared/hq'
import { parseExternalJsonl } from '../shared/hqAdapt'

/** Directory holding the six .jsonl stores, resolved against the app dir. */
export const HQ_DIR = 'data'

export const hqStoreFile = (dir: string, store: HQStoreName): string =>
  path.join(dir, `${store}.jsonl`)

/**
 * Load one store. A missing file is an empty store, not an error;
 * corrupt lines surface in `errors` with their line numbers.
 */
export function loadHQStore(dir: string, store: HQStoreName): HQStoreData {
  const file = hqStoreFile(dir, store)
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf-8')
  } catch {
    /* no store yet — empty, not an error */
  }
  const { blocks, errors } = parseHQJsonl(text)
  return { store, blocks, errors, generatedAt: Date.now() }
}

/**
 * Load one EXTERNAL store (the read-only lens over Novakai-Command's
 * .novakai/stores). Lines are adapted from the record contract into HQBlocks
 * (see shared/hqAdapt.ts). Unlike `loadHQStore`, a read failure is not swallowed
 * as "empty": a missing source directory or an unreadable file becomes a
 * store-level `sourceError` carrying the path we tried — so the UI reports it
 * instead of looking innocently empty. A missing *file* inside a present dir is
 * a legitimately empty store (no error).
 */
export function loadExternalStore(dir: string, store: HQStoreName): HQStoreData {
  const file = hqStoreFile(dir, store)
  let text = ''
  let sourceError: string | undefined
  try {
    text = fs.readFileSync(file, 'utf-8')
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      // Distinguish a missing source directory from an absent-but-fine store file.
      if (!fs.existsSync(dir)) sourceError = `source directory not found: ${dir}`
    } else {
      sourceError = `could not read ${file}: ${err.message ?? String(err)}`
    }
  }
  const { blocks, errors } = parseExternalJsonl(text)
  return {
    store,
    blocks,
    errors,
    generatedAt: Date.now(),
    ...(sourceError ? { sourceError } : {}),
  }
}

/** Persist a store's blocks atomically (tmp file + rename). */
export function saveHQStore(dir: string, store: HQStoreName, blocks: readonly HQBlock[]): void {
  const file = hqStoreFile(dir, store)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, serializeHQJsonl(blocks))
  fs.renameSync(tmp, file)
}
