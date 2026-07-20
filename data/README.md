# data/ — the Novakai Docs stores

Typed-block JSONL everywhere. One block per line, one store per file.

## Rules

- **JSONL, not JSON arrays** — agents append without rewriting; git diffs stay one line per change.
- **Every block** has at least: `id`, `kind`, `title`, `created`, `updated`.
- **Refs are open-world.** Any block may carry `refs: [{ kind, value, label? }]`.
  `kind` is a free-form string — `sessionId`, `designId`, `exp`, `pr`, `doc`, whatever.
  There is no menu of relation types. Use a kind and it exists. We watch what emerges.
- **Statuses are open strings**; views interpret (`todo/doing/done`, `idea/draft/published`).
- **Private notes do NOT live here.** Anything personal goes in `private/` (gitignored).

## Stores

| File | Holds |
|---|---|
| `tasks.jsonl` | the board — work items |
| `timeline.jsonl` | append-only event log, one block per thing that happened |
| `decisions.jsonl` | the big calls, with context and veto status |
| `experiments.jsonl` | index of build experiments; the `.md` body is a `doc` ref |
| `projects.jsonl` | project registry — goal, status, current focus |
| `content.jsonl` | article/post pipeline: idea → draft → published |
