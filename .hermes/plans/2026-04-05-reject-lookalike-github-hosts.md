# Reject lookalike GitHub hosts when parsing repo input

## Goal
Tighten `parseGitHubRepoInput` so Discofork only accepts real GitHub repository hosts instead of any hostname that merely ends with `github.com`.

## Why this improvement matters
The current hostname check accepts lookalike domains like `notgithub.com` and non-repository hosts like `api.github.com`. Those inputs can be misparsed into incorrect `owner/name` pairs and send user or queued work down the wrong path.

## Current observations
- `src/services/github.ts` currently uses `/github\.com$/i` against `url.hostname`.
- That regex accepts hosts such as `notgithub.com` and `api.github.com`.
- `test/github.test.ts` covers happy-path URLs and shorthand parsing, but it does not cover hostname validation regressions.

## Exact files to change
- `src/services/github.ts`
- `test/github.test.ts`

## Step-by-step implementation plan
1. Replace the permissive hostname regex with a small helper that only accepts supported repository hosts.
2. Preserve canonical `github.com` parsing and keep `owner/name` shorthand unchanged.
3. Add regression tests for accepted GitHub URLs and rejected lookalike/API hosts.
4. Run targeted and full validation.
5. Review the diff, then commit, push, and open a PR linked to issue #30.

## Validation commands
- `npx bun test test/github.test.ts`
- `npx bun run typecheck`
- `npx bun test`

## Risks / rollback notes
- Main risk: rejecting a hostname variant that users legitimately paste. Keep the allowlist narrow but include `www.github.com` for compatibility.
- Rollback is straightforward: revert the hostname helper and tests in this branch.
