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

## Corpus changes

The corpus is live: an edit reaches every reader and run at once, merged or not.
Only the integrator edits it, and only after a merge. A PR that changes what a
corpus page says puts the change in its body under `## Corpus changes`: each page
by title, the section, and the new text in full. The reviewer checks that text
against the code. After merging, the integrator applies it with the `wireframe-corpus` MCP
tools, re-reads each page to confirm, and names the changed pages in its merge
report. For a maintainer merge, the handoff names the corpus changes the
maintainer applies after merging. A PR that closes unmerged changes nothing.

## Human decisions

`@uberblick-ai/maintainers` answers scope and policy questions. Decision records
marked `decided` in the corpus are settled answers. The format is free to change
throughout 0.x: when implementing it or a sample shows a better form, change the
code and write the corpus change into the same PR, as "Corpus changes" above
describes. A keyword, attribute or syntax rule the issue doesn't need is still a
scope question.
An issue's author may answer only if they have write access. Use the responsible
role's correction or handoff route when that role must act next.

## Review focus

- Behavior matches the corpus requirement the issue implements (for the first
  release, "Format v0.1") together with the PR's corpus changes. A mismatch is a
  finding; never quietly change either side.
- The constraints in AGENTS.md: no runtime dependencies, inert output, scoped CSS,
  diagnostics instead of silent drops, limits checked before rendering.
- The public API: everything exported is a promise. The PR names additions;
  removals and renames need a maintainer.
- Every new diagnostic has a test. Every new kind has a rendering test and appears
  in a golden screenshot, in light and dark.
