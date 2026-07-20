import { describe, expect, it } from 'vitest'
import type { HQBlock } from '../../shared/hq'
import {
  bucketByStatus,
  collectRefKinds,
  collectStatuses,
  dayKey,
  dayLabel,
  groupByDay,
  kindHue,
  matchesFilter,
  storeSourceSubtitle,
  timeLabel,
} from './hqView'

const T = '2026-01-01T00:00:00.000Z'
const block = (id: string, extra: Partial<HQBlock> = {}): HQBlock => ({
  id,
  kind: 'task',
  title: id,
  created: T,
  updated: T,
  ...extra,
})

describe('bucketByStatus', () => {
  it('buckets exact matches and lands unknown/missing statuses in todo', () => {
    const blocks = [
      block('a', { status: 'todo' }),
      block('b', { status: 'doing' }),
      block('c', { status: 'done' }),
      block('d', { status: 'later' }),
      block('e'),
    ]
    const { columns, unknownStatusCount } = bucketByStatus(blocks)
    expect(columns.todo.map((b) => b.id)).toEqual(['a', 'd', 'e'])
    expect(columns.doing.map((b) => b.id)).toEqual(['b'])
    expect(columns.done.map((b) => b.id)).toEqual(['c'])
    expect(unknownStatusCount).toBe(1)
  })

  it('keeps array order within a column (the persisted order)', () => {
    const blocks = [block('a'), block('b'), block('c')]
    expect(bucketByStatus(blocks).columns.todo.map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('day/time labels', () => {
  it('formats day labels as "Sun 19 Jul" and keys as YYYY-MM-DD', () => {
    const d = new Date(2026, 6, 19, 15, 4) // 19 Jul 2026 is a Sunday
    expect(dayLabel(d)).toBe('Sun 19 Jul')
    expect(dayKey(d)).toBe('2026-07-19')
    expect(timeLabel(d)).toBe('15:04')
  })
})

describe('groupByDay', () => {
  const at = (b: HQBlock) => (typeof b.at === 'string' ? b.at : b.created)

  it('groups reverse-chronologically under day headers', () => {
    const blocks = [
      block('a', { at: '2026-07-19T09:00:00+10:00' }),
      block('b', { at: '2026-07-19T22:00:00+10:00' }),
      block('c', { at: '2026-07-18T12:00:00+10:00' }),
    ]
    const groups = groupByDay(blocks, at)
    expect(groups).toHaveLength(2)
    expect(groups[0].blocks.map((b) => b.id)).toEqual(['b', 'a'])
    expect(groups[1].blocks.map((b) => b.id)).toEqual(['c'])
    expect(groups[0].label).toMatch(/^\w{3} \d{1,2} \w{3}$/)
  })

  it('puts unparseable timestamps at the bottom, honestly labeled', () => {
    const groups = groupByDay([block('a', { at: 'not a date' }), block('b', { at: '2026-07-19T09:00:00Z' })], at)
    expect(groups[1].key).toBe('unknown')
    expect(groups[1].label).toBe('Unknown date')
    expect(groups[1].blocks[0].id).toBe('a')
  })
})

describe('kindHue', () => {
  it('is deterministic and in range', () => {
    expect(kindHue('sessionId')).toBe(kindHue('sessionId'))
    for (const k of ['sessionId', 'designId', 'exp', 'pr', 'doc', 'project', 'x']) {
      const h = kindHue(k)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })

  it('gives different kinds different hues (for the common seeded kinds)', () => {
    const hues = new Set(['sessionId', 'designId', 'exp', 'pr', 'doc'].map(kindHue))
    expect(hues.size).toBeGreaterThan(1)
  })
})

describe('collectRefKinds / collectStatuses', () => {
  it('collects sorted unique values', () => {
    const blocks = [
      block('a', { status: 'todo', refs: [{ kind: 'pr', value: 'x#1' }, { kind: 'exp', value: 'E-1' }] }),
      block('b', { status: 'done', refs: [{ kind: 'pr', value: 'x#2' }] }),
      block('c'),
    ]
    expect(collectRefKinds(blocks)).toEqual(['exp', 'pr'])
    expect(collectStatuses(blocks)).toEqual(['done', 'todo'])
  })
})

describe('matchesFilter', () => {
  const b = block('a', {
    notes: 'ship the thing',
    refs: [{ kind: 'sessionId', value: 'session_abc', label: 'Night Shift' }],
  })

  it('matches title, notes, ref values/kinds/labels; empty query matches all', () => {
    expect(matchesFilter(b, '')).toBe(true)
    expect(matchesFilter(b, 'a')).toBe(true)
    expect(matchesFilter(b, 'ship')).toBe(true)
    expect(matchesFilter(b, 'session_abc')).toBe(true)
    expect(matchesFilter(b, 'sessionid')).toBe(true)
    expect(matchesFilter(b, 'night shift')).toBe(true)
    expect(matchesFilter(b, 'zzz')).toBe(false)
  })
})

describe('storeSourceSubtitle', () => {
  it('uses the resolved dir for both source modes, normalizing a trailing slash', () => {
    expect(storeSourceSubtitle('decisions.jsonl', '/a/b/.novakai/stores', 'ready')).toBe(
      '/a/b/.novakai/stores/decisions.jsonl',
    )
    // internal dir is still the truthful path — not replaced with a relative label
    expect(storeSourceSubtitle('tasks.jsonl', '/app/data/', 'ready')).toBe('/app/data/tasks.jsonl')
    expect(storeSourceSubtitle('okrs.jsonl', '/x///', 'ready')).toBe('/x/okrs.jsonl')
  })

  it('never asserts data/ before the source is established', () => {
    expect(storeSourceSubtitle('decisions.jsonl', null, 'loading')).toBe('Resolving source…')
    expect(storeSourceSubtitle('decisions.jsonl', null, 'error')).toBe('Source unavailable')
    // dir wins even if state is stale
    expect(storeSourceSubtitle('decisions.jsonl', '/d', 'error')).toBe('/d/decisions.jsonl')
  })
})
