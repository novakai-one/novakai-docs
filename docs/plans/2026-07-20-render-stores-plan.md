# Plan — render Novakai-Command's `.novakai/stores/` as read-only pages

**Author:** Docs Render · opus  ·  **For review by:** chief-kimi  ·  **Date:** 2026-07-20
**Status:** DRAFT — no code until approved.

## Goal

Turn novakai-docs into a read-only lens on the system of record at
`/Users/christopherdasca/Programming/Novakai-Command/.novakai/stores/` (8 JSONL
stores). The source files are never written by this app. The viewer's internal
contract (`shared/hq.ts`) stays as-is; external record blocks are **normalized at
the data edge** into that contract on load. Decision per kimi: **adapter, not a
second contract** — keeps the viewer decoupled from the record (low coupling).

## Design principle for this build

The record's contract (`id, kind, ts, …`) is theirs. The viewer's contract
(`HQBlock`) is ours. The adapter is the one seam between them, and it lives in
exactly one place. Everything downstream of the adapter already works — views,
polling, error notices — because they only ever see well-formed `HQBlock`s.

---

## 1. Where the adapter lives

**A new pure module `shared/hqAdapt.ts`, invoked from the data edge in `server/hqFile.ts`.**

Why not inside `parseHQJsonl`: that function already gates every line through
`isHQBlock` and rejects non-conforming lines as `errors`. External blocks
(missing `title`/`created`/`updated`, carrying `ts`) would be dropped *before*
any adapter could see them. So the adapter must run on the **raw parsed JSON**,
not on validated blocks.

Shape:

- `shared/hqAdapt.ts` (PURE, no fs/fetch — fabricated fixtures in future tests):
  - `adaptExternalBlock(raw: unknown): HQBlock | { error: string }`
    - Requires `id` + `kind` (the record's real invariants). Missing either → `error`.
    - **Timestamps (SEVERE-1 CORRECTED):** the 7 refile tombstones in the real
      `tasks.jsonl` carry only `updated` — no `created`, no `ts` — so the original
      `created = raw.created ?? raw.ts` mapping produced `created: undefined` and
      failed `isHQBlock`. Corrected fallback covers them:
      `created = raw.created ?? raw.ts ?? raw.updated`;
      `updated = raw.updated ?? raw.ts ?? created`.
      Original `ts` is preserved as a passthrough extra.
    - **Title fallback:** `title ?? question ?? firstLine(body) ?? id`. (captains-log,
      learnings, and KRs have no title → derive from `body`; requests → `question`;
      the tombstones fall through to `id`.)
    - **Passthrough:** every other field (`body`, `options`, `question`, `horizon`,
      `intent`, `evidence`, `owner`, `focus`, `path`, `priority`, `objective`,
      `refiledTo`, `ts`, …) is kept verbatim in the block's extras. `HQBlock` already
      allows `[extra: string]`, so views read `b.body` / `b.options` / `b.horizon`
      directly. The adapter **adds** the required fields; it never strips.
    - **Validate before returning (SEVERE-1 / MODERATE-2):** after normalization,
      run the canonical `isHQBlock` guard. If it still fails (malformed `refs`,
      non-string existing timestamp, etc.), return `{ error }` with a precise reason
      — never cast-and-trust. The seam's guarantee that downstream sees only valid
      `HQBlock`s is then real, not asserted.
- `server/hqFile.ts` gains `loadExternalStore(dir, storeName): HQStoreData`:
  read file → split lines → `JSON.parse` each → `adaptExternalBlock` → collect
  `{ line, reason }` for genuinely broken lines (bad JSON, or missing id/kind).
  Same honest-error contract as today; missing file = empty store, not an error.

`shared/hq.ts` is **untouched**. `parseHQJsonl` / `isHQBlock` stay as the viewer's
internal shape guarantee — the adapter's output still satisfies `isHQBlock`, so the
existing invariants hold end-to-end.

Note: no okr splitting in the adapter — that's a view concern (§5). The adapter
loads all `objective` + `kr` blocks; the OKR view partitions by `kind`.

## 2. Store-name union reconciliation

Real 8 (from AGENTS.md, verified against the files):
`decisions, requests, missions, tasks, captains-log, learnings, okrs, projects`.

Current union in `shared/hq.ts`: `tasks, timeline, decisions, experiments, projects, content`.

- **Keep:** `tasks`, `decisions`, `projects` (exist both sides).
- **Add:** `requests`, `missions`, `captains-log`, `learnings`, `okrs`.
  (`captains-log` → file `captains-log.jsonl`; `hqStoreFile` already builds
  `${store}.jsonl`, hyphen is fine.)
- **Retire:** `timeline`, `experiments`, `content` — no upstream source (YAGNI).
  The **Timeline *view*** survives but repoints at `captains-log` (the log *is* the
  timeline). `experiments`/`content` drop entirely.

Touch points when building: the `HQStoreName` union + `HQ_STORE_NAMES` in
`shared/hq.ts`; `HQ_STORE_FILE`/`HQ_TITLES`/view switch in `src/App.tsx`;
`useHQStore('timeline')` → `'captains-log'` in `HQTimeline.tsx`.

## 3. External data-source config (dev vs packaged)

Add an optional `storesDir` to `MdApiDeps` and resolve it in `createMdApiMiddleware`,
**replacing** the hardcoded `hqDir = join(appDir, 'data')` for HQ routes:

```
storesDir resolution (first hit wins):
  deps.storesDir  →  env NVK_STORES_DIR  →  fallback join(appDir, 'data')
```

- Default target: `/Users/christopherdasca/Programming/Novakai-Command/.novakai/stores`
  (absolute). Set via the Vite plugin's dev entry and via env for flexibility.
- **Missing dir is not a crash:** each store loads empty + an honest notice, same
  as a missing file today.
- **Packaged/userData interaction (the known bug):** because HQ stores now read
  from an **absolute external path independent of `userData`**, the packaged app no
  longer depends on a seeded `userData/data` for these stores at all — so this
  change *sidesteps* the unseeded-userData bug for HQ rather than worsening it. The
  markdown-reader's own config/store files (`.novakai-docs-*.json`) still anchor at
  `appDir` and are out of scope here.
- **Packaged wiring is durable, not env-only (SEVERE-3 CORRECTED):** the audit is
  right that a Finder-launched `.app` does not inherit an interactive shell's env,
  so `NVK_STORES_DIR` alone leaves the packaged app reading the unseeded
  `userData/data` — the exact bug we're killing. Fix: `electron/main.ts` must pass a
  **durable packaged default** (the absolute `.novakai/stores` path) plus the env
  override into `createMdApiMiddleware`. That file is dirty from another session and
  the one line I'd change (`createMdApiMiddleware({ appDir: dataDir })`, L83) is a
  line *they* just modified — so per kimi's coordination rule this is a collision,
  not an additive edit. **I ship the change as `docs/patches/packaged-storesdir.patch`
  for the owner to apply**, and it is called out in the handoff. Dev wiring via
  `vite.config.ts` (clean file) proceeds regardless, which is what the browser-verify
  stop-point exercises.
- **Provenance is one value (MODERATE-5):** middleware resolves a single
  `{ dir, readOnly, source }` — `deps.storesDir` or a non-empty `NVK_STORES_DIR`
  ⇒ `readOnly: true` and `source: 'external'`; the internal `appDir/data` fallback
  ⇒ `readOnly: false`, `source: 'internal'`. That same value drives BOTH the four
  write guards AND the GET payload — read-only is never inferred twice. No brittle
  path comparison.
- **Missing source is visible (MODERATE-4):** external loading distinguishes ENOENT
  from an empty file and returns a store-level `sourceError` + the resolved `dir` in
  the payload, so the UI reports the path it tried instead of looking innocently
  empty. Permission/I/O errors are not swallowed as "no store yet".

## 4. Read-only enforcement

Two layers, server is the source of truth:

- **Server (authoritative):** a `readOnly` flag on the HQ config (true whenever
  serving external stores). In `middleware.ts`, the four mutating `/api/hq`
  branches (`POST`, `POST /reorder`, `PATCH`, `DELETE`) short-circuit with
  `sendError(res, 405, 'stores are read-only')` before any file access. GET stays open.
- **Client (honest UX):** the server stamps `readOnly: true` into the `HQStoreData`
  payload. Views read it and hide/disable mutators — Board's quick-add form + drag
  handles, Inspector's editable fields become display-only. No dead buttons that
  silently 405. `useHQStore`'s optimistic `mutate` path simply goes unused for
  external stores.

This means even if a control leaks through, the server refuses. Belt and braces.

## 5. Views

Reuse where the shape fits; add small function-first views where it doesn't.
Minimal styling this round — the existing dark/amber tokens, no polish pass.

| Store | View | Build |
|---|---|---|
| `captains-log` | **Timeline** (reuse `HQTimeline`) | repoint to `captains-log`, `timeOf` = `ts`; title = first line of `body` |
| `tasks` | **Board** (reuse `HQBoard`) | read-only: no add/DnD; `bucketByStatus` already handles todo/done + unknowns |
| `projects` | **Projects** (reuse `HQProjects`) | read-only |
| `decisions` | **List** (small new/generic) | reverse-chron cards: title + body + refs; `ts` timestamp |
| `missions` | **List by status** (small new/generic) | group by `status`; show owner/priority/refs |
| `requests` | **Inbox** (new) | `question` + `options[]` + status (pending/answered) + ref to the decision it produced |
| `learnings` | **Learnings** (new) | `body` + **evidence ref chip** surfaced prominently (no evidence = flag it) |
| `okrs` | **OKRs by horizon** (new) | columns now/next/later; objectives (`kind:objective`) with their KRs (`kind:kr`, `objective` ref) nested under them |

A single generic "record list" component likely covers `decisions` + `missions`
and is the base for others — decide during build to avoid premature abstraction.
`RefChips` + `kindHue` are reused everywhere (open-world ref coloring already works).

## 6. Rough time estimates

| Chunk | Est. |
|---|---|
| `shared/hqAdapt.ts` + `loadExternalStore` in `hqFile.ts` | 1.5–2 h |
| Store-name union reconciliation (shared + App + Timeline repoint) | 0.5–1 h |
| `storesDir` config + resolution in middleware + Vite dev entry | 1 h |
| Read-only enforcement (server 405 + `readOnly` in payload + view guards) | 1–1.5 h |
| Reuse-view repoints (Board/Timeline/Projects read-only) | 1 h |
| New views: decisions/missions list, requests inbox, learnings, OKRs | 3–4 h |
| Browser-verify every store end-to-end (per Chris's standing rule) | 1 h |
| **Total** | **~9–11.5 h** |

Suggested order: adapter+edge → config → union → read-only → reuse views →
new views → verify. The adapter is the keystone; nothing renders correctly until
it's right, so it goes first and gets eyeballed against real data before views.

---

## Gotchas acknowledged

- **Dirty working tree — do not touch other sessions' files or commit.** Current
  uncommitted files: `README.md`, `data/README.md`, `data/tasks.jsonl`,
  `electron-builder.yml`, `electron/main.ts`, **`src/App.tsx`**, `main.cjs` (untracked).
  Kimi named the first four as the other session's in-flight data-dir work.
  **⚠️ `src/App.tsx` is also dirty** and my build needs to edit it (view switch +
  store names) — flagging this as a required coordination point before I touch it,
  so I don't clobber their in-flight edit.
- **No new test files or gates this round.** Verify by running the app and looking.
  (`shared/hqAdapt.ts` is written pure so tests can be added later without rework.)
- **Leave the two stale "Novakai HQ" userData refs** (`main.ts` ~L56, `README.md`
  L79) — inside the other session's notes, untouched.
- **Verification:** every store gets driven in a real browser with `~/.claude/browse`
  before I report anything done — click through, scroll, read screenshots.

## Open questions for kimi

1. OKR view — nest KRs under objectives (tree), or two flat sections? I lean tree
   (matches OKR→Project→Mission→Task mental model), but it's more layout work.
2. `missions` — is a status-grouped list enough, or do you want the Board treatment
   (mission statuses aren't todo/doing/done, so Board would dump most into "todo")?
3. Confirm `NVK_STORES_DIR` as the env name, and whether you want a committed default
   pointing at the absolute `.novakai/stores` path or env-only for now.
