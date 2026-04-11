# Repository Index: Add owner/repo search

## Goal
Add a shareable owner/repo text search to `/repos` so readers can find a repository quickly without losing the existing order, status, and pagination flow.

## Why this improvement matters
The repository index already contains more than a thousand rows. Paging and sort controls are not enough when someone wants one specific repository; search is the obvious missing capability and makes the index immediately more usable.

## Current observations
- `/repos` currently supports `page`, `order`, and `status` only.
- `web/src/app/repos/page.tsx` and `web/src/app/api/repos/route.ts` each parse repository-list query params separately.
- `web/src/lib/server/reports.ts:listRepoRecords()` already owns the shared list query path and is the right place to add a single SQL filter.
- Existing pagination links do not preserve a search term because the feature does not exist yet.

## Exact files to change
- `web/src/lib/repository-list.ts`
- `web/src/lib/server/reports.ts`
- `web/src/app/api/repos/route.ts`
- `web/src/app/repos/page.tsx`
- `test/repo-list-search.test.ts`
- `test/repos-api-route.test.ts`

## Step-by-step implementation plan
1. Extend the shared repository-list view shape to carry the normalized search query.
2. Parse and normalize `query` in both the page route and `/api/repos`, and pass it through the existing list-loading flow.
3. Add an escaped case-insensitive `full_name` SQL filter inside `listRepoRecords()` so search reuses the existing list query path.
4. Add a GET-based search form to `/repos`, preserve `order` and `status`, and ensure next/previous links keep the query.
5. Show a search-specific empty state when no repositories match.
6. Add focused regression tests for the SQL/query propagation and route parsing.

## Validation commands
- `npx bun run typecheck`
- `npx bun test`

## Risks / rollback notes
- The main risk is accidentally changing pagination or filter behavior when `query` is empty. Keep the filter additive and omit it entirely when the normalized query is blank.
- If the SQL filter behaves unexpectedly, rollback is isolated to the repository-index files above.
