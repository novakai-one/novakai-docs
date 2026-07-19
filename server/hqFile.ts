/**
 * server/hqFile.ts — HQ typed-block stores on disk (data/<store>.jsonl).
 * fs edge; the operations on the blocks themselves live in shared/hq.ts (pure).
 * Saves are atomic: write a tmp file, then rename over the store.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { HQBlock, HQStoreData, HQStoreName } from '../shared/hq'
import { parseHQJsonl, serializeHQJsonl } from '../shared/hq'

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

/** Persist a store's blocks atomically (tmp file + rename). */
export function saveHQStore(dir: string, store: HQStoreName, blocks: readonly HQBlock[]): void {
  const file = hqStoreFile(dir, store)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, serializeHQJsonl(blocks))
  fs.renameSync(tmp, file)
}
