export const siteCatalog = {
  title: "wireframe-md",
  tagline: "A small, inspectable showcase for supported wireframe syntax and rendered output.",
  sections: [
    {
      id: "screen",
      name: "screen",
      summary: "A screen is the top-level application, browser, or mobile frame. Screens can render as placeholder shells or host one nested layout tree.",
      notes: [
        "A wireframe document still starts with top-level screen nodes.",
        "When a screen has no children, it renders the original placeholder body.",
        "When a screen contains one child layout node, the viewport renders nested layout instead of placeholder content.",
      ],
      syntax: [
        "screen profile title=\"Profile\" device=mobile",
        "screen settings title=\"Settings\" device=app width=1120 height=760",
        "screen dashboard title=\"Dashboard\" device=browser width=1366 height=900",
        "screen inspect title=\"Inspect\" device=browser url=\"http://localhost:3000/lookbook/inspect/ui/form/single_select/standard_render\"",
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
        {
          name: "url",
          values: "string",
          description: "Browser-only. Replaces the default address-bar text in browser chrome.",
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
          id: "browser-url",
          title: "Browser Shell with URL",
          description: "Browser chrome can display a custom URL to match a real route or lookbook path.",
          markdown: [
            "```wireframe[980x700]",
            "screen inspect title=\"Inspect\" device=browser url=\"http://localhost:3000/lookbook/inspect/ui/form/single_select/standard_render\"",
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
    {
      id: "split",
      name: "split",
      summary: "A recursive layout primitive that divides available space horizontally or vertically and nests inside a screen or another split.",
      notes: [
        "This is the first nested layout primitive in the DSL.",
        "A split must contain at least two children.",
        "Current leaf support is intentionally minimal and uses `region` placeholders.",
      ],
      syntax: [
        "split axis=horizontal sizes=\"260,rest\"",
        "split axis=horizontal sizes=\"260,rest\" surface=plain",
        "split axis=vertical sizes=\"rest,180\"",
        "region label=\"Sidebar\" surface=plain",
        "region label=\"Preview\"",
      ],
      options: [
        {
          name: "axis",
          values: "`horizontal` | `vertical`",
          description: "Controls whether the split lays out children side by side or stacked top to bottom.",
        },
        {
          name: "sizes",
          values: "comma-separated fixed pixels and `rest`",
          description: "Assigns one track size per child, for example `\"260,rest\"` or `\"rest,180\"`.",
        },
        {
          name: "surface",
          values: "`card` | `plain`",
          description: "Controls whether the split uses gapped card-style panes or full-space panes separated by dividers.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `screen`",
          values: "one child layout tree",
          description: "A screen may host one nested layout node instead of the default placeholder content.",
        },
        {
          name: "`region label=\"...\"`",
          values: "temporary leaf placeholder",
          description: "Use `region` as a low-fidelity leaf while the component vocabulary is still small. `surface=plain` removes the card chrome.",
        },
      ],
      demos: [
        {
          id: "lookbook-skeleton",
          title: "Lookbook Skeleton",
          description: "A browser screen with a divider-separated sidebar and card-based preview and params regions.",
          markdown: [
            "```wireframe[980x700]",
            "screen lookbook title=\"Lookbook\" device=browser width=1366 height=820",
            "  split axis=horizontal sizes=\"260,rest\" surface=plain",
            "    region label=\"Sidebar\" surface=plain",
            "    split axis=vertical sizes=\"rest,180\"",
            "      region label=\"Preview\"",
            "      region label=\"Params\"",
            "```",
          ].join("\n"),
        },
        {
          id: "equal-columns",
          title: "Equal Columns",
          description: "Omitting `sizes` gives each child an equal share of the available space.",
          markdown: [
            "```wireframe[980x620]",
            "screen compare title=\"Compare\" device=app width=1180 height=720",
            "  split axis=horizontal",
            "    region label=\"Left Pane\"",
            "    region label=\"Right Pane\"",
            "```",
          ].join("\n"),
        },
      ],
    },
  ],
};
