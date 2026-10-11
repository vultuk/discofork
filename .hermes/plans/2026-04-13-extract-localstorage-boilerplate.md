# ExecPlan: Extract localStorage boilerplate into shared utility

## Goal

Eliminate duplicated SSR-safe localStorage boilerplate across 5+ files by creating a generic factory utility.

## Why

Each localStorage file (bookmarks, watches, history, notes, tags) duplicated the same SSR detection, try/catch, and JSON.parse pattern. Any change to this pattern (e.g., adding error logging, changing SSR behavior) would require updating every file independently. This refactor creates a single source of truth.

## Current observations

- `web/src/lib/bookmarks.ts`, `watches.ts`, `history.ts`, `notes.ts`, `tags.ts` all had ~15 lines of identical boilerplate
- Two patterns exist: array-based stores and map-based stores
- `compare.ts` was left unchanged because it interleaves URL parameter logic with localStorage

## Files changed

- `web/src/lib/local-storage.ts` — new shared factory with `createArrayStore` and `createMapStore`
- `web/src/lib/bookmarks.ts` — refactored to use `createArrayStore`
- `web/src/lib/watches.ts` — refactored to use `createArrayStore` (keeps `touchWatch` and `hasUpdate`)
- `web/src/lib/history.ts` — refactored to use `createArrayStore` (keeps custom `addHistory` with max-entries and sorting)
- `web/src/lib/notes.ts` — refactored to use `createMapStore`
- `web/src/lib/tags.ts` — refactored to use `createMapStore` (keeps all tag-specific logic)

## Validation

- `npx bun run typecheck` in web/ — passed
- `npx bun run typecheck` in root — passed
- `npx bun test` — 104 pass, 0 fail

## Risks

- None behavioral: all public APIs are preserved identically
- SSR behavior unchanged (returns empty on server)
