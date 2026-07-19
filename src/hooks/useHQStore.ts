/**
 * src/hooks/useHQStore.ts — polls one HQ store (data/<store>.jsonl via the
 * API) so external agent edits appear live. Mutations are optimistic:
 * apply locally, send the request, then reconcile with the server —
 * a failure surfaces an honest error and rolls back to server truth.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HQBlock, HQStoreData, HQStoreName } from '../../shared/hq'
import { api } from '../lib/api'

export interface UseHQStore {
  data: HQStoreData | null
  /** The store could not be loaded/polled (last good data stays on screen). */
  loadError: string | null
  /** The last mutation failed; the view has already rolled back. */
  mutationError: string | null
  pending: boolean
  refresh: () => Promise<void>
  mutate: (
    request: () => Promise<unknown>,
    optimistic?: (blocks: HQBlock[]) => HQBlock[],
  ) => Promise<void>
}

export function useHQStore(store: HQStoreName, pollMs = 5000): UseHQStore {
  const [data, setData] = useState<HQStoreData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const d = await api.hq(store)
      setData(d)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load store')
    }
  }, [store])

  useEffect(() => {
    // Deferred so the effect body itself stays free of setState; the first
    // poll fires immediately after mount, then every pollMs.
    const first = setTimeout(() => void refresh(), 0)
    const t = setInterval(() => {
      if (!pendingRef.current) void refresh()
    }, pollMs)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [refresh, pollMs])

  const mutate = useCallback(
    async (request: () => Promise<unknown>, optimistic?: (blocks: HQBlock[]) => HQBlock[]) => {
      setMutationError(null)
      if (optimistic) setData((d) => (d ? { ...d, blocks: optimistic(d.blocks) } : d))
      pendingRef.current = true
      setPending(true)
      try {
        await request()
        await refresh()
      } catch (e) {
        setMutationError(e instanceof Error ? e.message : 'Could not save')
        await refresh()
      } finally {
        pendingRef.current = false
        setPending(false)
      }
    },
    [refresh],
  )

  return { data, loadError, mutationError, pending, refresh, mutate }
}
