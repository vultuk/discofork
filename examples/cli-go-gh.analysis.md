# Discofork Report: cli/go-gh

Generated: 2026-03-29T10:37:09.994Z
Repository: https://github.com/cli/go-gh

## Upstream
`cli/go-gh` is an active Go library for building command-line tooling around `gh` and the GitHub API, especially GitHub CLI extensions. Its value to fork evaluators is that it already wraps `gh` conventions for repository resolution, authentication, terminal behavior, output formatting, and browser launching, so forks are most interesting if they change or extend those integration points rather than inventing them from scratch.

### Capabilities
- Executes `gh` commands from Go and reads their output.
- Provides default REST API client support for GitHub API access.
- Respects `gh`-style environment and auth conventions such as `GH_REPO`, `GH_TOKEN`, and `GH_HOST`.
- Uses shared terminal and output conventions, including TTY/color handling, table output, and Go template output.
- Includes a browser module for opening the user's preferred web browser.

### Target Users
- Go developers authoring GitHub CLI extensions.
- CLI developers who want GitHub API access that follows `gh` behavior by default.
- Projects that need command-line integration with `gh` rather than a standalone GitHub client.

### Recommendation Snapshot
- Best maintained: None
- Closest to upstream: kim-em/go-gh
- Most feature-rich: None
- Most opinionated: None

## Forks

### kim-em/go-gh

- Updated: 27d ago
- Stars: 0
- Maintenance: unknown
- Change magnitude: minor
- Likely purpose: Inference: a personal-namespace mirror or placeholder fork of `cli/go-gh` rather than a differentiated alternative.
- Decision summary: Choose this fork only if you need an unchanged mirror in this namespace. For most adopters, upstream `cli/go-gh` is the better default because this fork currently provides no differentiated functionality or maintenance signal.
- Categories: maintenance_only

Strengths:
- It is currently identical to upstream at the recorded merge base, so adopters should get the same `gh`-aligned CLI and GitHub API behavior described for `cli/go-gh`.
- There is no fork-specific divergence to audit, which reduces adoption risk for teams that just need an unchanged copy under a different namespace.
- The fork was created and pushed recently relative to the provided snapshot, so it is not an obviously abandoned historical copy.

Risks:
- There is no user-facing added value yet: no unique commits, changed files, insertions, or deletions.
- Maintenance intent is unclear because the metadata shows no parent repo and the fork has zero stars, zero forks, and no independent commit history.
- If you want upstream momentum, the upstream project is the clearer default because it shows active recent maintenance and documented scope for GitHub CLI extension development.

Best for:
- Users who specifically need this code under `kim-em/go-gh` without behavior changes.
- Teams pinning an internal mirror or temporary fork for packaging, access-control, or experimentation reasons.
- Not ideal for adopters looking for extra features, fixes, or a meaningfully different roadmap from `cli/go-gh`.
