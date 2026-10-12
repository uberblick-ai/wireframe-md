import {
  type Approval, approvalFingerprint, describeStatus, fingerprint, formatMarkup, type Status, statusOf,
} from "../playground/approval.js";
import { folderLabel, leafOf, validName } from "../playground/catalog.js";
import type { Section } from "./manifest.js";

export type Renderer = Pick<typeof import("../src/index.js"), "parseWireframe" | "renderWireframe" | "getEmbedStyles" | "summarizeWireframe">;
export type Approvals = Readonly<Record<string, Approval>>;

interface Example {
  id: string;
  source: string;
  html: string;
  summary: string;
  status: Status;
  diagnostics: string[];
}

/** Missing approvals are normal before the first human review; invalid entries cannot pass the gate. */
export function parseApprovals(text: string): Approvals {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected an approval mapping");
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, Approval] => {
    const approval: unknown = entry[1];
    return typeof approval === "object" && approval !== null &&
      "approved" in approval && typeof approval.approved === "boolean" &&
      "fingerprint" in approval && typeof approval.fingerprint === "string" && /^sha256:[0-9a-f]{64}$/.test(approval.fingerprint);
  }));
}

/**
 * Build-time rendering only. The CLI supplies the freshly built package and a
 * jsdom document; tests supply fixture approvals and the current source API.
 * Every offending id is reported together. Preview bypasses only approval
 * status, never missing examples or rendering errors.
 */
export async function generateShowcase(options: {
  sections: readonly Section[];
  readSource: (id: string) => string | null;
  approvals: Approvals;
  renderer: Renderer;
  document: Document;
  preview?: boolean;
}): Promise<string> {
  const { sections, readSource, approvals, renderer, document, preview = false } = options;
  const stylesheet = await fingerprint(renderer.getEmbedStyles());
  const examples = new Map<string, Example>();
  const problems: string[] = [];
  for (const section of sections) {
    for (const id of section.examples) {
      if (!validName(id)) {
        problems.push(`${id}: invalid example id`);
        continue;
      }
      if (examples.has(id)) {
        problems.push(`${id}: listed more than once`);
        continue;
      }
      const source = readSource(id);
      if (source === null) {
        problems.push(`${id}: missing example`);
        continue;
      }
      const result = renderer.parseWireframe(source);
      const diagnostics = result.diagnostics.map((d) => `Line ${d.line}: ${d.message}`);
      const rendered = renderer.renderWireframe(result, document);
      if (result.diagnostics.some((d) => d.severity === "error") || rendered === null) {
        problems.push(`${id}: has errors${diagnostics.length === 0 ? " (could not render)" : `; ${diagnostics.join("; ")}`}`);
        continue;
      }
      // Use the playground's formatted markup and the digest of its stylesheet,
      // not raw outerHTML or the stylesheet text, to match human approvals.
      const current = await approvalFingerprint(source, stylesheet, formatMarkup(rendered));
      const status = statusOf(current, approvals[id] ?? null);
      if (!preview && status.state !== "approved") problems.push(`${id}: ${describeStatus(status)}`);
      examples.set(id, { id, source, html: rendered.outerHTML, summary: renderer.summarizeWireframe(result), status, diagnostics });
    }
  }
  if (problems.length > 0) throw new Error(`Showcase build refused:\n${problems.join("\n")}`);
  return page(sections, examples, preview);
}

const ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

function exampleCard(example: Example, preview: boolean): string {
  const { id, source, html, summary, status, diagnostics } = example;
  const headingId = `example-${id.replaceAll("/", "-")}`;
  const title = folderLabel(leafOf(id));
  const notes = diagnostics.length === 0 ? "" : `<ul class="showcase-diagnostics">${diagnostics.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`;
  return `<article class="showcase-example" aria-labelledby="${headingId}">
  <h3 id="${headingId}"><a href="#${headingId}">${escapeHtml(title)}</a></h3>
  ${preview ? `<p class="showcase-status" data-status="${status.state}">${escapeHtml(describeStatus(status))} · <code>${escapeHtml(id)}</code></p>` : ""}
  ${notes}
  <div class="showcase-comparison">
    <div class="block code showcase-source"><div class="cap">Source · wireframe</div><pre><code>${escapeHtml(source)}</code></pre></div>
    <div class="showcase-renders">
      ${["light", "dark"].map((scheme) => `<figure class="showcase-render showcase-${scheme}">
        <figcaption>${scheme === "light" ? "Light" : "Dark"}</figcaption>
        <div class="showcase-ground" role="img" aria-label="${escapeHtml(`${scheme === "light" ? "Light" : "Dark"} wireframe: ${summary}`)}">${html}</div>
      </figure>`).join("\n")}
    </div>
  </div>
</article>`;
}

function page(sections: readonly Section[], examples: ReadonlyMap<string, Example>, preview: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="A small text format for wireframes. Browse component examples and full-page designs, with source and light and dark renders.">
  ${preview ? '<meta name="robots" content="noindex">' : ""}
  <title>wireframe.md · Uberblick${preview ? " · Preview" : ""}</title>
  <link rel="stylesheet" href="https://uberblick.ai/shared.css">
  <link rel="stylesheet" href="./site.css">
  <link rel="stylesheet" href="./wireframe.css">
</head>
<body class="showcase">
<div class="wrap">
  <header class="top">
    <a class="brand" href="https://uberblick.ai">überblick<i aria-hidden="true"></i></a>
    <nav aria-label="Resources"><a href="https://www.npmjs.com/package/@uberblick/wireframe">npm</a><a href="https://github.com/uberblick-ai/wireframe-md/blob/main/AUTHORING.md">Authoring</a><a href="https://github.com/uberblick-ai/wireframe-md">GitHub</a></nav>
  </header>
  <main>
    <div class="showcase-intro">
      <p class="caption">TEXT IN, WIREFRAMES OUT</p>
      <h1>wireframe.md</h1>
      <p>A small text format for wireframes. Write a <code>\`\`\`wireframe</code> code block and <a href="https://www.npmjs.com/package/@uberblick/wireframe"><code>@uberblick/wireframe</code></a> renders it as static HTML. Use it to sketch a component or a whole page in an Uberblick document.</p>
      <p>Explore the source beside each drawing, in light and dark. <a href="https://github.com/uberblick-ai/wireframe-md/blob/main/AUTHORING.md">Read the authoring guide</a> to write your own.</p>
      ${preview ? '<p class="showcase-preview">Preview for review. Examples marked “Not yet approved” or “Changed since approval” must be approved in the local playground before deployment.</p>' : ""}
    </div>
    <nav class="showcase-nav" aria-label="Example sections">${sections.map((s) => `<a href="#${escapeHtml(s.id)}">${escapeHtml(s.title)}</a>`).join("\n")}</nav>
    ${sections.map((s) => `<section class="showcase-section" id="${escapeHtml(s.id)}" aria-labelledby="${escapeHtml(s.id)}-title">
      <h2 id="${escapeHtml(s.id)}-title">${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.description)}</p>
      ${s.examples.map((id) => {
        const example = examples.get(id);
        if (example === undefined) throw new Error(`${id}: missing prepared example`);
        return exampleCard(example, preview);
      }).join("\n")}
    </section>`).join("\n")}
  </main>
  <footer class="end"><span>wireframe.md · MIT</span><nav aria-label="Footer"><a href="https://uberblick.ai">Uberblick</a><a href="https://github.com/uberblick-ai/wireframe-md">Repository</a><a href="#">Back to top</a></nav></footer>
</div>
</body>
</html>
`;
}
