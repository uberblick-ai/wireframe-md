// @ts-check

/**
 * @typedef {"select" | "input" | "text"} ShowcaseParamKind
 * @typedef {{ key: string, kind: ShowcaseParamKind, value: string, options?: string[] }} ShowcaseParam
 * @typedef {{ id: string, title: string, description: string, sourceLines: string[], params: ShowcaseParam[], renderOptions?: { boxWidth?: number | null, boxHeight?: number | null } }} ShowcaseExample
 * @typedef {{ id: string, label: string, description: string, examples: ShowcaseExample[] }} ShowcaseGroup
 */

export const showcaseMeta = {
  title: "wireframe.md",
  tagline: "A public capability gallery for the wireframe DSL itself.",
  summary:
    "The showcase dogfoods wireframe-md against its own use cases: curated examples, rendered previews, informational params, and the exact source behind each layout.",
  githubUrl: "https://github.com/uberblick-ai/wireframe-md",
  localCommand: "mise run dev",
};

/** @type {ShowcaseGroup[]} */
export const showcaseGroups = [
  {
    id: "screen",
    label: "Screen",
    description: "Top-level browser, app, and mobile shells.",
    examples: [
      {
        id: "screen/browser/plain",
        title: "Browser Screen",
        description: "A plain browser shell with a single preview region and a real-looking URL bar.",
        params: [
          { key: "Device", kind: "select", value: "browser", options: ["mobile", "app", "browser"] },
          { key: "Surface", kind: "select", value: "plain", options: ["card", "plain"] },
          { key: "URL", kind: "input", value: "https://wireframe.md/examples/browser" },
        ],
        sourceLines: [
          "screen browser_demo title=\"Browser Screen\" device=browser surface=plain url=\"https://wireframe.md/examples/browser\"",
          "  region label=\"Preview\"",
        ],
      },
      {
        id: "screen/mobile/inbox",
        title: "Mobile Screen",
        description: "A mobile shell showing that the same DSL can switch device chrome without changing layout concepts.",
        params: [
          { key: "Device", kind: "select", value: "mobile", options: ["mobile", "app", "browser"] },
          { key: "Surface", kind: "text", value: "card" },
          { key: "Render Box", kind: "text", value: "height-capped" },
        ],
        renderOptions: { boxHeight: 620 },
        sourceLines: [
          "screen inbox title=\"Inbox\" device=mobile",
          "  region label=\"Messages\"",
        ],
      },
    ],
  },
  {
    id: "frame",
    label: "Frame",
    description: "Standalone artifacts without device chrome.",
    examples: [
      {
        id: "frame/contact",
        title: "Contact Form Frame",
        description: "A shell-less artifact when the component matters more than the surrounding browser or app chrome.",
        params: [
          { key: "Surface", kind: "select", value: "card", options: ["card", "plain"] },
          { key: "Width", kind: "text", value: "480" },
          { key: "Height", kind: "text", value: "360" },
        ],
        sourceLines: [
          "frame contact title=\"Contact Form\" width=480 height=360",
          "  region label=\"Form\"",
        ],
      },
    ],
  },
  {
    id: "layouts",
    label: "Common Region Layouts",
    description: "Curated region compositions that feel like product UI rather than isolated placeholders.",
    examples: [
      {
        id: "layout/two-column",
        title: "Two-Column Split",
        description: "A simple left-right layout that introduces split sizing and nested regions.",
        params: [
          { key: "Axis", kind: "text", value: "horizontal" },
          { key: "Sizes", kind: "text", value: "280,rest" },
          { key: "Surface", kind: "select", value: "plain", options: ["card", "plain"] },
        ],
        sourceLines: [
          "screen compare title=\"Two Column Layout\" device=app surface=plain",
          "  split axis=horizontal sizes=\"280,rest\" surface=plain",
          "    region label=\"Sidebar\" surface=plain",
          "    region label=\"Main Content\"",
        ],
      },
      {
        id: "layout/sidebar-preview",
        title: "Sidebar and Preview",
        description: "A common product shape with navigation on the left and a stable content focus on the right.",
        params: [
          { key: "Axis", kind: "text", value: "horizontal + vertical" },
          { key: "Sidebar", kind: "text", value: "280px" },
          { key: "Preview", kind: "text", value: "fills remaining space" },
        ],
        sourceLines: [
          "screen dashboard title=\"Sidebar and Preview\" device=browser surface=plain url=\"https://wireframe.md/examples/sidebar-preview\"",
          "  split axis=horizontal sizes=\"280,rest\" surface=plain",
          "    region label=\"Sidebar\" surface=plain show_label=false",
          "      tree",
          "        group label=\"Navigation\"",
          "          item label=\"Overview\" selected=true",
          "          item label=\"Reports\"",
          "          item label=\"Settings\"",
          "    region label=\"Preview\"",
        ],
      },
      {
        id: "layout/lookbook-shell",
        title: "Lookbook Shell",
        description: "The full lookbook-style shell that the public showcase is aiming to become.",
        params: [
          { key: "Device", kind: "select", value: "browser", options: ["mobile", "app", "browser"] },
          { key: "Surface", kind: "select", value: "plain", options: ["card", "plain"] },
          { key: "URL", kind: "input", value: "https://wireframe.md/lookbook" },
        ],
        sourceLines: [
          "screen lookbook title=\"wireframe.md Lookbook\" device=browser surface=plain url=\"https://wireframe.md/lookbook\"",
          "  split axis=vertical sizes=\"auto,rest\" surface=plain",
          "    region label=\"Top Bar: wireframe.md brand + theme toggle\" surface=plain placeholder=false",
          "    split axis=horizontal sizes=\"280,rest\" surface=plain",
          "      region label=\"Sidebar\" surface=plain show_label=false",
          "        tree",
          "          group label=\"Screen\"",
          "            item label=\"Browser Screen\"",
          "            item label=\"Mobile Screen\"",
          "          group label=\"Common Region Layouts\"",
          "            item label=\"Lookbook Shell\" selected=true",
          "      split axis=vertical sizes=\"rest,240\"",
          "        region label=\"Preview: selected wireframe example\"",
          "        split axis=horizontal sizes=\"rest,rest\"",
          "          region label=\"Params\"",
          "            props",
          "              prop key=\"Device\"",
          "                select value=\"browser\" options=\"mobile,app,browser\"",
          "              prop key=\"Surface\"",
          "                select value=\"plain\" options=\"card,plain\"",
          "              prop key=\"URL\"",
          "                input type=\"url\" value=\"https://wireframe.md/lookbook\"",
          "          region label=\"Markdown\"",
          "            code_block language=\"wireframe\"",
          "              code_line \"screen lookbook title=\\\"wireframe.md Lookbook\\\" device=browser surface=plain\"",
          "              code_line \"  split axis=vertical sizes=\\\"auto,rest\\\" surface=plain\"",
        ],
      },
    ],
  },
];

export function getDefaultExampleId() {
  return showcaseGroups[0]?.examples[0]?.id || "";
}
