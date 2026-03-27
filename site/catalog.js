export const siteCatalog = {
  title: "wireframe-md",
  tagline: "A small, inspectable showcase for supported wireframe syntax and rendered output.",
  sections: [
    {
      id: "screen",
      name: "screen",
      summary: "The only supported element in v0. A screen is a top-level application, browser, or mobile frame rendered with a low-fidelity shell.",
      notes: [
        "Only top-level screen nodes are supported in v0.",
        "The interior is intentionally placeholder content for now. We are validating shells, variants, sizing, and documentation flow before adding more elements.",
      ],
      syntax: [
        "screen profile title=\"Profile\" device=mobile",
        "screen settings title=\"Settings\" device=app width=1120 height=760",
        "screen dashboard title=\"Dashboard\" device=browser width=1366 height=900",
      ],
      options: [
        {
          name: "title",
          values: "string",
          description: "Human-readable name shown in the shell header and device chrome.",
        },
        {
          name: "device",
          values: "`mobile` | `app` | `browser`",
          description: "Selects the frame style and default intrinsic size.",
        },
        {
          name: "width",
          values: "number",
          description: "Overrides the intrinsic width for the screen.",
        },
        {
          name: "height",
          values: "number",
          description: "Overrides the intrinsic height for the screen.",
        },
      ],
      blockOptions: [
        {
          name: "```wireframe[x400]```",
          values: "fluid width, 400px height cap",
          description: "Controls the rendered block footprint, not the intrinsic screen size.",
        },
        {
          name: "```wireframe[960x]```",
          values: "960px width, auto height",
          description: "Useful for stable docs layouts when width matters more than height.",
        },
        {
          name: "```wireframe[1280x800]```",
          values: "1280 by 800 render box",
          description: "Sets both width and height for the rendered block container.",
        },
      ],
      demos: [
        {
          id: "app-default",
          title: "Desktop App Shell",
          description: "Default desktop application frame.",
          markdown: [
            "```wireframe[980x700]",
            "screen settings title=\"Settings\" device=app",
            "```",
          ].join("\n"),
        },
        {
          id: "browser-default",
          title: "Browser Shell",
          description: "Default web browser frame with browser chrome.",
          markdown: [
            "```wireframe[980x700]",
            "screen dashboard title=\"Dashboard\" device=browser",
            "```",
          ].join("\n"),
        },
        {
          id: "mobile-default",
          title: "Mobile Shell",
          description: "Default phone shell with mobile viewport proportions.",
          markdown: [
            "```wireframe[460x920]",
            "screen inbox title=\"Inbox\" device=mobile",
            "```",
          ].join("\n"),
        },
        {
          id: "multiple-screens",
          title: "Multiple Screens in One Block",
          description: "A single wireframe block can render more than one screen, stacked in document order.",
          markdown: [
            "```wireframe[980x1220]",
            "screen studio title=\"Studio App\" device=app width=1120 height=760",
            "screen marketing title=\"Marketing Site\" device=browser width=1280 height=720",
            "```",
          ].join("\n"),
        },
        {
          id: "explicit-dimensions",
          title: "Explicit Width and Height",
          description: "Intrinsic dimensions are defined directly with `width` and `height`.",
          markdown: [
            "```wireframe[820x360]",
            "screen analytics title=\"Analytics Overview\" device=browser width=1440 height=520",
            "```",
          ].join("\n"),
        },
        {
          id: "height-capped",
          title: "Height-Capped Render Box",
          description: "The render box can constrain how much space the showcase block consumes.",
          markdown: [
            "```wireframe[x420]",
            "screen account title=\"Account\" device=mobile",
            "```",
          ].join("\n"),
        },
      ],
    },
  ],
};
