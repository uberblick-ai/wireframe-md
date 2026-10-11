# Project loop policy

Read [AGENTS.md](../AGENTS.md) first: it holds the project facts and the
constraints every change keeps.

## Checks

Run all of these on the final change and record the results:

- `mise run lint`
- `mise run typecheck`
- `mise run test`
- `mise run build`, once the package has a build

A change that alters rendered output updates its golden screenshots in the same PR
and names in the PR body which ones changed and why. A check that passes only after
changing its environment or skipping tests has not passed.

## Changelog

Once `CHANGELOG.md` exists, a change a package user can notice adds a line under
`Unreleased` in the same PR.

## Merging

The integrator squash-merges when the reviewer approved the current head and the
`lint, typecheck and tests` check is green on it. A PR that changes `ub-agents.yaml`,
`.agents/`, CI or release workflows, the package name, its exports or version, or
the licence is a maintainer merge. Never enable auto-merge, approve your own PR,
change branch protection, publish to npm, or create tags or releases.
Implementation PR bodies start with `Closes #N`.

## Human decisions

`@uberblick-ai/maintainers` answers scope and policy questions. Decision records
marked `decided` in the corpus are settled answers. A new keyword,
attribute or syntax rule is a scope question unless the issue already settles it.
An issue's author may answer only if they have write access. Use the responsible
role's correction or handoff route when that role must act next.

## Review focus

- Behavior matches the corpus requirement the issue implements (for the first
  release, "Format v0.1"). A mismatch is a finding; never quietly change either side.
- The constraints in AGENTS.md: no runtime dependencies, inert output, scoped CSS,
  diagnostics instead of silent drops, limits checked before rendering.
- The public API: everything exported is a promise. The PR names additions;
  removals and renames need a maintainer.
- Every new diagnostic has a test. Every new kind has a rendering test and appears
  in a golden screenshot, in light and dark.
