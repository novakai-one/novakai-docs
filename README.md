# Novakai Docs

A local markdown reader for people who just want to *read* their docs.
Watches folders, dedupes worktree copies, renders clean markdown. No vault, no IDE.

```bash
npm install
npm run dev        # → http://localhost:7100
npm test           # Vitest (colocated *.test.ts)
npm run typecheck  # tsc -b
npm run build      # tsc -b && vite build
```

## Features

- **Multi-root watch** — any number of folders; add/remove at runtime, persisted in `.novakai-docs-roots.json`.
- **Worktree dedup** — files with identical content hash collapse into one entry with a `×N` copies badge.
- **Hidden folders included** — `.kimi`, `.claude`, `.novakai` are scanned; only VCS internals and build junk are skipped.
- **⌘K quick-open**, favorites, recents (persisted in `.novakai-docs-store.json`), raw/rendered toggle, dark mode, drag-and-drop, reveal-in-Finder, copy-path.
- **Tasks tab** — a per-root task list (typed JSON in `<root>/tasks.json`): add, check off, click-to-edit, delete.
- **Live** — polls every 5 s; new files get a banner, the open file reloads when it changes on disk.

## Architecture

Typed JSON blocks everywhere. One contract, two ends.

```
shared/            the contract — pure, no node, no DOM
  types.ts         every JSON block on the wire (FilesIndex, FileEntry, RootInfo, StoreData, TasksData, …)
  api.ts           route paths + URL builders (client & server share these)
  store.ts         pure StoreData ops (toggleFavorite, pushRecent, …)
  tasks.ts         pure TasksData ops (addTask, setStatus, editTask, removeTask)

server/            the backend — one module, one reason to exist
  scanner.ts       fs edge: walk roots → RawFile[] (per-root errors, never silent)
  hashing.ts       fs edge: content hash + mtime cache
  dedup.ts         PURE: RawFile[] + injected hashFn → FileEntry[]
  config.ts        roots config file (defaults, load, save)
  storeFile.ts     StoreData JSON file (load, save, type guard)
  tasksFile.ts     per-root tasks.json (load, save, type guard; corrupt → empty)
  middleware.ts    connect-style handler: HTTP ↔ the modules above. Vite-free —
                   mount it in Express/Fastify/any node server.
  plugin.ts        thin Vite wrapper around the middleware

src/               the client — dumb components, typed SDK
  lib/api.ts       fetch SDK: every endpoint returns a shared/ block
  lib/tree.ts      PURE: flat list → folder tree
  lib/paths.ts     PURE: posix path helpers
  lib/ui.ts        UI-local types (Selection, DroppedFile, View)
  hooks/useFileIndex.ts   polling, new-file + changed-file detection
  components/      Sidebar, FileTree, QuickOpen, MarkdownView, TasksTab, TopBar (props in, events out)
  App.tsx          composition root: state + wiring only
```

Config/data files live next to the app (`.novakai-docs-roots.json`, `.novakai-docs-store.json`).

## Standards (as in Novakai-Analytics `STANDARDS.md`)

- 10 principles: pure cores (`dedup`, `tree`, `paths`, `store` ops) with fs/HTTP at the edges only; DRY contract in `shared/`; middleware composable into any connect server.
- Errors carry reasons (`ApiError`, `RootStatus.error`) — never fabricated empty results.
- Vitest colocated `*.test.ts`: pure functions get fabricated fixtures, fs edges get temp-dir integration tests.
- Gates before done: `npm test` + `npm run typecheck` green (26 tests at time of writing).
