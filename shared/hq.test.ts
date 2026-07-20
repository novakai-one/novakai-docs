import { describe, expect, it } from 'vitest'
import type { HQBlock, Ref } from './hq'
import {
  addRef,
  isHQBlock,
  isHQStoreName,
  moveBlock,
  newBlock,
  parseHQJsonl,
  patchBlock,
  removeBlock,
  removeRef,
  serializeHQJsonl,
} from './hq'
import { adaptExternalBlock, parseExternalJsonl } from './hqAdapt'

const T = '2026-01-01T00:00:00.000Z'

const block = (id: string, extra: Partial<HQBlock> = {}): HQBlock => ({
  id,
  kind: 'task',
  title: id,
  created: T,
  updated: T,
  ...extra,
})

describe('isHQStoreName', () => {
  it('accepts the eight record stores and rejects everything else', () => {
    for (const s of ['decisions', 'requests', 'missions', 'tasks', 'captains-log', 'learnings', 'okrs', 'projects'])
      expect(isHQStoreName(s)).toBe(true)
    // retired sample stores are no longer valid
    expect(isHQStoreName('timeline')).toBe(false)
    expect(isHQStoreName('experiments')).toBe(false)
    expect(isHQStoreName('content')).toBe(false)
    expect(isHQStoreName('task')).toBe(false)
    expect(isHQStoreName('')).toBe(false)
    expect(isHQStoreName(undefined)).toBe(false)
    expect(isHQStoreName(42)).toBe(false)
  })
})

describe('isHQBlock', () => {
  it('accepts a minimal block and one with optionals + extras', () => {
    expect(isHQBlock(block('a'))).toBe(true)
    expect(
      isHQBlock(block('b', { status: 'todo', notes: 'n', refs: [{ kind: 'pr', value: 'x#1' }], focus: 'f' })),
    ).toBe(true)
  })

  it('rejects missing required fields and bad optionals', () => {
    expect(isHQBlock({})).toBe(false)
    expect(isHQBlock({ ...block('a'), id: '' })).toBe(false)
    expect(isHQBlock({ ...block('a'), kind: 1 })).toBe(false)
    expect(isHQBlock({ ...block('a'), status: 5 })).toBe(false)
    expect(isHQBlock({ ...block('a'), refs: [{ kind: 'pr' }] })).toBe(false)
    expect(isHQBlock('nope')).toBe(false)
    expect(isHQBlock(null)).toBe(false)
  })
})

describe('parseHQJsonl', () => {
  it('parses good lines, skips blanks, keeps extras', () => {
    const good = block('a', { status: 'todo', priority: 'important' })
    const { blocks, errors } = parseHQJsonl(`\n${JSON.stringify(good)}\n\n`)
    expect(errors).toEqual([])
    expect(blocks).toEqual([good])
    expect(blocks[0].priority).toBe('important')
  })

  it('collects bad lines with 1-based line numbers, never throws', () => {
    const good = JSON.stringify(block('a'))
    const text = `${good}\n{not json\n{"id":"x"}\n${good}`
    const { blocks, errors } = parseHQJsonl(text)
    expect(blocks).toHaveLength(2)
    expect(errors).toHaveLength(2)
    expect(errors[0].line).toBe(2)
    expect(errors[0].reason).toContain('invalid JSON')
    expect(errors[1]).toEqual({ line: 3, reason: 'missing kind' })
  })

  it('round-trips through serializeHQJsonl', () => {
    const original = [block('a'), block('b', { notes: 'n', refs: [{ kind: 'exp', value: 'E-1', label: 'L' }] })]
    const { blocks, errors } = parseHQJsonl(serializeHQJsonl(original))
    expect(errors).toEqual([])
    expect(blocks).toEqual(original)
  })

  it('serializes an empty store to empty text', () => {
    expect(serializeHQJsonl([])).toBe('')
    expect(parseHQJsonl('')).toEqual({ blocks: [], errors: [] })
  })
})

describe('newBlock', () => {
  it('builds a block with id, timestamps, kind and extras', () => {
    const b = newBlock({ title: '  ship it  ', kind: 'task', status: 'todo', focus: 'now' })
    expect(b.title).toBe('ship it')
    expect(b.kind).toBe('task')
    expect(b.status).toBe('todo')
    expect(b.focus).toBe('now')
    expect(b.id).toBeTruthy()
    expect(Date.parse(b.created)).not.toBeNaN()
    expect(b.updated).toBe(b.created)
  })

  it('defaults kind and omits absent optionals', () => {
    const b = newBlock({ title: 'x' })
    expect(b.kind).toBe('block')
    expect('status' in b).toBe(false)
    expect('refs' in b).toBe(false)
  })

  it('never lets caller input override identity or provenance', () => {
    const b = newBlock({ title: 'x', id: 'evil', created: 'evil', updated: 'evil', kind: 'task' })
    expect(b.id).not.toBe('evil')
    expect(Date.parse(b.created)).not.toBeNaN()
    expect(b.kind).toBe('task')
  })
})

describe('patchBlock', () => {
  it('applies the patch and bumps updated, leaving others alone', () => {
    const next = patchBlock([block('a'), block('b')], 'a', { status: 'done', notes: 'n' })
    expect(next[0].status).toBe('done')
    expect(next[0].notes).toBe('n')
    expect(Date.parse(next[0].updated)).toBeGreaterThan(Date.parse(T))
    expect(next[1]).toEqual(block('b'))
  })

  it('never patches identity fields', () => {
    const next = patchBlock([block('a')], 'a', { id: 'evil', kind: 'evil', created: 'evil', updated: 'evil' })
    expect(next[0]).toEqual(block('a'))
  })

  it('keeps and adds extra fields', () => {
    const next = patchBlock([block('a', { focus: 'old' })], 'a', { focus: 'new', path: '/p' })
    expect(next[0].focus).toBe('new')
    expect(next[0].path).toBe('/p')
  })

  it('deletes keys patched to null (how JSON clears an optional field)', () => {
    const next = patchBlock([block('a', { status: 'todo', notes: 'n' })], 'a', {
      status: null,
      notes: null,
    })
    expect('status' in next[0]).toBe(false)
    expect('notes' in next[0]).toBe(false)
    expect(Date.parse(next[0].updated)).toBeGreaterThan(Date.parse(T))
  })

  it('ignores unknown ids', () => {
    const blocks = [block('a')]
    expect(patchBlock(blocks, 'nope', { status: 'done' })).toEqual(blocks)
  })
})

describe('removeBlock', () => {
  it('drops the block and keeps the rest', () => {
    expect(removeBlock([block('a'), block('b')], 'a').map((b) => b.id)).toEqual(['b'])
  })

  it('ignores unknown ids', () => {
    const blocks = [block('a')]
    expect(removeBlock(blocks, 'nope')).toEqual(blocks)
  })
})

describe('moveBlock', () => {
  const three = [block('a'), block('b'), block('c')]

  it('moves a block to an explicit index', () => {
    expect(moveBlock(three, 'c', 0).map((b) => b.id)).toEqual(['c', 'a', 'b'])
    expect(moveBlock(three, 'a', 2).map((b) => b.id)).toEqual(['b', 'c', 'a'])
  })

  it('clamps out-of-range indices', () => {
    expect(moveBlock(three, 'a', 99).map((b) => b.id)).toEqual(['b', 'c', 'a'])
    expect(moveBlock(three, 'c', -5).map((b) => b.id)).toEqual(['c', 'a', 'b'])
  })

  it('ignores unknown ids and does not mutate the input', () => {
    expect(moveBlock(three, 'nope', 0)).toEqual(three)
    moveBlock(three, 'a', 2)
    expect(three.map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('adaptExternalBlock', () => {
  it('maps ts→created/updated and derives title from the first body line', () => {
    const r = adaptExternalBlock({ id: 'log_1', kind: 'log', ts: T, body: 'Did the thing.\nDetails.' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.block.created).toBe(T)
    expect(r.block.updated).toBe(T)
    expect(r.block.title).toBe('Did the thing.')
    expect(r.block.ts).toBe(T) // passthrough preserved
  })

  it('falls back created to updated for the refile tombstone, title to id', () => {
    const r = adaptExternalBlock({ id: 'task_x', kind: 'task', status: 'refiled', refiledTo: 'm1', updated: T })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.block.created).toBe(T)
    expect(r.block.updated).toBe(T)
    expect(r.block.title).toBe('task_x')
  })

  it('prefers explicit title, then question, then body, then id', () => {
    expect((adaptExternalBlock({ id: 'a', kind: 'k', ts: T, title: 'T', question: 'Q', body: 'B' }) as { block: HQBlock }).block.title).toBe('T')
    expect((adaptExternalBlock({ id: 'a', kind: 'k', ts: T, question: 'Q', body: 'B' }) as { block: HQBlock }).block.title).toBe('Q')
    expect((adaptExternalBlock({ id: 'a', kind: 'k', ts: T, body: 'B' }) as { block: HQBlock }).block.title).toBe('B')
    expect((adaptExternalBlock({ id: 'a', kind: 'k', ts: T }) as { block: HQBlock }).block.title).toBe('a')
  })

  it('errors on missing id/kind and validates after normalizing (malformed refs)', () => {
    expect(adaptExternalBlock({ kind: 'k', ts: T })).toEqual({ ok: false, error: 'missing id' })
    expect(adaptExternalBlock({ id: 'a', ts: T })).toEqual({ ok: false, error: 'missing kind' })
    expect(adaptExternalBlock('nope')).toEqual({ ok: false, error: 'not an object' })
    // passes id/kind but the normalized block still violates the contract
    expect(adaptExternalBlock({ id: 'a', kind: 'k', ts: T, refs: [{ kind: 'pr' }] })).toEqual({
      ok: false,
      error: 'refs is not Ref[]',
    })
    // no created/ts/updated at all → created stays undefined → contract violation
    expect(adaptExternalBlock({ id: 'a', kind: 'k' })).toEqual({ ok: false, error: 'missing created' })
  })

  it('output satisfies the internal isHQBlock guard', () => {
    const r = adaptExternalBlock({ id: 'a', kind: 'k', ts: T, title: 'x', status: 'open', refs: [{ kind: 'doc', value: 'd' }] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(isHQBlock(r.block)).toBe(true)
  })
})

describe('parseExternalJsonl', () => {
  it('adapts good lines, collects bad ones with 1-based numbers, skips blanks', () => {
    const good = JSON.stringify({ id: 'a', kind: 'decision', ts: T, title: 'ok' })
    const text = `\n${good}\n{not json\n{"kind":"x","ts":"${T}"}\n`
    const { blocks, errors } = parseExternalJsonl(text)
    expect(blocks.map((b) => b.id)).toEqual(['a'])
    expect(errors.map((e) => e.line)).toEqual([3, 4])
    expect(errors[0].reason).toContain('invalid JSON')
    expect(errors[1].reason).toBe('missing id')
  })
})

describe('ref ops', () => {
  const ref: Ref = { kind: 'sessionId', value: 'session_abc', label: 'S' }

  it('addRef appends, creating the array when missing', () => {
    const b = addRef(block('a'), ref)
    expect(b.refs).toEqual([ref])
    const b2 = addRef(b, { kind: 'pr', value: 'x#1' })
    expect(b2.refs).toHaveLength(2)
    expect(b2.refs?.[0]).toEqual(ref)
  })

  it('removeRef drops by index', () => {
    const b = addRef(addRef(block('a'), ref), { kind: 'pr', value: 'x#1' })
    const out = removeRef(b, 0)
    expect(out.refs).toEqual([{ kind: 'pr', value: 'x#1' }])
    expect(b.refs).toHaveLength(2)
  })
})
