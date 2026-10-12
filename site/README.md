# wireframe.md showcase

A static showcase for wireframes.uberblick.ai, built from the curated ids in
[`manifest.ts`](manifest.ts). Sections may combine several example families.
There are 15 examples, including the Uberblick document list and sidebar pages.
Edit the manifest to change their selection or order; keep 10–20 examples,
every section represented and at least two full pages.

The build first rebuilds the package at the current commit, then uses its
renderer with jsdom to write HTML. The output contains only `index.html`,
`site.css` and `wireframe.css`. Readers need no JavaScript. The page loads
`https://uberblick.ai/shared.css` for the sibling sites' fonts, tokens and shell;
the renders use the package stylesheet's defaults on separate light and dark
Canvas grounds, just like the playground's standalone host.

## Build and review locally

```sh
mise run install
mise run site-preview
python3 -m http.server 8000 --directory site/preview
```

Open http://127.0.0.1:8000/. The preview renders the current examples and marks
each one's approval status. It writes only to `site/preview`, never `site/out`.
Missing examples and rendering errors still fail the preview build. To use
only Node and pnpm, run `pnpm install --frozen-lockfile` and
`pnpm site:preview` instead of the mise tasks.

Review the listed examples with `mise run playground`, using the standalone
host. Only a person's Approve control writes `examples/approvals.json`. Commit
that file after reviewing. The site build never writes approvals.

```sh
mise run site
```

This deploy build writes to `site/out` only after every listed example exists,
renders without errors and has a matching human approval. It reports every
offending id in one failure. Fingerprints reuse the playground's exact helpers:
SHA-256 of the saved source, the stylesheet's SHA-256 digest and the formatted
rendered markup. Changing any of these requires a person to approve again.
The light and dark hosts do not change the fingerprint.

`mise run test` checks the gate with in-memory fixture approvals and checks that
the real manifest's ids exist and render without errors. It never reads the
real approvals, so a package stylesheet change can pass CI while deployment
waits for review. `mise run screenshots` also checks the showcase with
JavaScript disabled at desktop and phone widths. No site files enter the npm
package; `mise run check-package` verifies that after a package build.

## Cloudflare Pages

Create a Pages project for `uberblick-ai/wireframe-md` with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Root directory | Repository root (leave empty) |
| Build command | `pnpm install --frozen-lockfile && pnpm site` |
| Build output directory | `site/out` |
| `NODE_VERSION` environment variable | `26.7.0` (Node 26, matching `mise.toml`) |
| `PNPM_VERSION` environment variable | `10.34.5` (matching `packageManager`) |

Use these settings for both production and Pages branch builds. Keep the
approval gate enabled in every Pages build: never use `site:preview` there or
set its output to `site/preview`. Pages needs only Node and pnpm; it does not
need mise or a browser. Version overrides are documented in Cloudflare's
[build image guide](https://developers.cloudflare.com/pages/configuration/build-image/),
and build commands and output directories in its
[build configuration guide](https://developers.cloudflare.com/pages/configuration/build-configuration/).

A missing or outdated approval exits with an error, so Pages keeps serving the
last successful production deployment. Before the first deployment, a person
must approve every listed example and commit the resulting approvals. Creating
the Pages project and attaching the custom domain `wireframes.uberblick.ai`
are maintainer steps after merge.
