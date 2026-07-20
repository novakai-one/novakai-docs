# Plan — docs viewer round 2: inspectability + honest source

**Author:** Docs Render · opus  ·  **Review:** codex audit → chief-kimi greenlight
**Branch:** `docs/render-stores-round2` off `docs/render-stores-viewer`  ·  **Date:** 2026-07-20
**Status:** DRAFT — no building until audited + greenlit.

Three fixes. Small surface, reuse the existing read-only `HQInspector`. No new frameworks.

## Fix 1 — Inspector everywhere (the big one)

**Problem:** clicks are dead on 6 of 7 record views (only Board/Projects open the
inspector); truncated log/decision/mission bodies are unreadable anywhere.

**Approach — one tiny hook + one inspector extension, then wire 5 files:**
- **New `src/hooks/useReadOnlyInspector.ts`** — local, boring selection state (no
  persistence, no mutate): `{ selectedId, block, open, width, select, close, resize }`.
  `block = blocks.find(selectedId)`; `open = block !== null`; local `width` (default 340,
  clamped 260–560). This is the read-only sibling of `useHQInspector` — that one carries
  layout persistence + mutate, which read-only views don't need.
- **Extend `HQInspector` read-only body** to render the extras a generic block drops:
  `options` (string[] → numbered list) and `evidence` (Ref[] → chips), in addition to the
  existing title/status/notes/**body**/refs. Body is already shown in full (no truncation).
- **Wire into the 5 views** by giving each the same horizontal layout Board/Projects use —
  outer `flex h-full`, content `flex min-w-0 flex-1 flex-col`, `{block && <HQInspector readOnly … />}`
  as the sibling — and making each record element a clickable target that calls `select(id)`:
  - `HQTimeline` (Log) — `<li>` → clickable, selected highlight
  - `HQRecordList` (Decisions + Missions) — cards clickable *(one change covers both)*
  - `HQRequests` — request cards clickable
  - `HQLearnings` — learning cards clickable
  - `HQOkrs` — objectives AND KRs both selectable (a KR is a real block)

`HQInspector` is reused as-is (props already include `readOnly`); `onPatch`/`onDelete`
are no-ops here and are already hidden in read-only mode.

**Files:** `hooks/useReadOnlyInspector.ts` (new), `HQInspector.tsx`, `HQTimeline.tsx`,
`HQRecordList.tsx`, `HQRequests.tsx`, `HQLearnings.tsx`, `HQOkrs.tsx`.

## Fix 2 — Nav model (no clipped tabs)

**Problem:** the record tabs live in the header capped at `max-w-[54%]` with
`overflow-x-auto`; sidebar-open at ~1560px the right tabs (OKRs/Projects) are clipped and
unclickable — scroll exists but Chris couldn't reach them.

**Approach:** move the tab strip to its **own full-width second row** inside `TopBar`
(header becomes two rows: title+actions on top, the Docs + 8-record tab strip below,
`flex-wrap` so it never clips and wraps gracefully at narrow widths). Full-width means the
tabs no longer compete with the title/actions for space. No App.tsx layout change — the
change is contained in `TopBar.tsx`.

**Files:** `TopBar.tsx`.

## Fix 3 — Source honesty

**Problem:** subtitles read `Docs · data/<store>.jsonl` while the real source is the
external `.novakai/stores/`. The payload already carries the resolved `dir`.

**Approach:** `App` fetches the resolved source once (a single `api.hq` GET on mount reads
`dir` + `source` from any store payload) into state; record-view subtitles become
`${dir}/<store>.jsonl` (full path in the `title` tooltip, truncated in the bar). Falls back
to `data/<file>` until loaded / when `source === 'internal'`. Now committed to our branch —
the round-1 line-preservation constraint is gone.

**Files:** `App.tsx` (small: one fetch effect + subtitle build), maybe a `useSourceDir` helper.

## The gate — named-item drive checklist (at 1560px, screenshots each)

Each row is CLICK + SEE, not "function exists". Both sidebar states for nav.

| # | Item | Evidence |
|---|---|---|
| 1–8 | Each store {decisions, requests, missions, tasks, captains-log, learnings, okrs, projects}: view renders → click a record → inspector opens → **full body/options/evidence/refs visible** | 8 screenshots (inspector open) |
| 9 | KR (not just objective) opens inspector in OKRs | screenshot |
| 10 | Nav: all tabs clickable, **sidebar OPEN** | screenshot |
| 11 | Nav: all tabs clickable, **sidebar CLOSED** | screenshot |
| 12 | Subtitle shows the real resolved `.novakai/stores` path | screenshot |
| 13 | `npm test` green (extend existing tests only), typecheck green | terminal |

## Estimate

- Fix 1 (hook + inspector extras + 5 view wirings): ~1.75h
- Fix 2 (two-row nav): ~0.5h
- Fix 3 (source honesty): ~0.5h
- Gate drive + screenshots (the heavy part): ~1h
- **Total ~3.75h** (H1 says ≤2h — I think the 13-item drive alone is ~1h, so I'm calling it honestly higher; happy to be proven fast).

## Boundaries acknowledged

Branch off `docs/render-stores-viewer`; small commits on this branch OK; no new test files
(extend existing); reuse HQInspector as-is; selection state local.
