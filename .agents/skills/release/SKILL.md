---
name: release
description: >-
  Release a prepared @uberblick/wireframe version when a maintainer explicitly
  invokes this skill. Not for loop roles, implementation or review runs.
---

# Release @uberblick/wireframe

Only use this skill in an interactive maintainer session that explicitly invokes
it. Never use it in a loop run (`UB_AGENTS_RUN` or `UB_AGENTS_RUN_CONFIG`); never
unset those guards. A request to implement or review release tooling is not a
release invocation.

The version PR comes first and is merged as usual. It sets `package.json` to
`X.Y.Z` and moves the `Unreleased` notes under exactly one non-empty
`## X.Y.Z — YYYY-MM-DD` heading with a valid calendar date. Work in a clean
checkout at current `origin/main`, with the mise toolchain, Git and authenticated
`gh` available. Use literal versions and SHAs in commands.

1. Run `mise run release X.Y.Z --check`. Report **go** or **no-go**, the checked
   commit SHA and the printed release notes in full, without rewriting them.
   A failing check is no-go. If CI is still running, report that the maintainer
   must wait; repeat only the check after CI finishes.
2. Wait for the maintainer's explicit go for that exact version and commit.
   Explain that publication starts a workflow requiring their `npm` environment
   approval, then creates the annotated tag and GitHub release. The skill
   invocation alone does not authorize publication.
3. After their go, confirm HEAD is still the approved SHA, then run
   `mise run release X.Y.Z`. The task repeats every check before dispatching.
   Share its workflow URL promptly so the maintainer can approve the deployment.
   Wait for the command to finish; report its workflow, tag and release links.
4. Confirm `npm view @uberblick/wireframe@X.Y.Z version` prints exactly `X.Y.Z`
   and `gh release view vX.Y.Z --repo uberblick-ai/wireframe-md --json url,tagName,isDraft`
   finds the published, non-draft release with that tag. Report both results,
   linking to the npm version and GitHub release. Verification failure is a
   failure to report, never permission to repeat publication.

On any failure or interruption, report the failed step, finished and remaining
steps and every available link. An unsuccessful command may have completed
remotely: ask the maintainer to inspect remote state and finish manually. Never
rerun publication, retry a publication step, or move, delete or re-create a
pushed tag. Never backfill v0.3.0 through this skill.
