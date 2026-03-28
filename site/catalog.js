// @ts-check

export const siteCatalog = {
  title: "wireframe-md",
  tagline: "A small, inspectable showcase for supported wireframe syntax and rendered output.",
  sections: [
    {
      id: "screen",
      name: "screen",
      summary: "A screen is the top-level application, browser, or mobile frame. Screens can render as placeholder shells or host one nested layout tree.",
      notes: [
        "A wireframe document can start with top-level `screen` or `frame` nodes.",
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
        {
          name: "surface",
          values: "`card` | `plain`",
          description: "Controls whether the screen renders inside the outer preview card or as the bare device frame; `plain` also suppresses the device outline stroke.",
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
      id: "frame",
      name: "frame",
      summary: "A frame is a shell-less top-level container for isolated wireframes such as a form, card, or modal body when surrounding device chrome is irrelevant.",
      notes: [
        "Use `frame` when you care about the component or artifact itself, not the browser, app, or phone shell around it.",
        "A frame can host one nested layout node, just like a screen.",
        "Default rendering uses a bounded card surface; `surface=plain` removes that chrome.",
      ],
      syntax: [
        "frame contact title=\"Contact Form\" width=480 height=360",
        "frame modal title=\"Invite People\" width=560 height=420 surface=card",
        "frame panel title=\"Sidebar\" width=280 height=640 surface=plain",
      ],
      options: [
        {
          name: "title",
          values: "string",
          description: "Optional label shown inside the frame container.",
        },
        {
          name: "width",
          values: "number",
          description: "Sets the intrinsic width for the frame. Defaults to 640.",
        },
        {
          name: "height",
          values: "number",
          description: "Sets the intrinsic height for the frame. Defaults to 420.",
        },
        {
          name: "surface",
          values: "`card` | `plain`",
          description: "Controls whether the frame renders as a bounded card or as a chrome-less container.",
        },
      ],
      blockOptions: [
        {
          name: "top-level `frame`",
          values: "standalone artifact",
          description: "Use this when a standalone wireframe should not be tied to browser or app chrome.",
        },
        {
          name: "nested under `frame`",
          values: "one child layout tree",
          description: "A frame can host one nested `split` or `region` node in the same way as `screen`.",
        },
      ],
      demos: [
        {
          id: "contact-form",
          title: "Standalone Contact Form",
          description: "An isolated form-sized artifact without browser or app shell chrome.",
          markdown: [
            "```wireframe[640x420]",
            "frame contact title=\"Contact Form\" width=480 height=360",
            "  region label=\"Form\"",
            "```",
          ].join("\n"),
        },
        {
          id: "plain-sidebar",
          title: "Plain Frame",
          description: "The same standalone container can remove the card chrome when the outer surface should feel invisible.",
          markdown: [
            "```wireframe[340x520]",
            "frame panel title=\"Sidebar\" width=280 height=460 surface=plain",
            "  region label=\"Filters\" surface=plain",
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
        "Regions can now host nested content such as `tree`, `stack`, `select`, `input`, `props`, and `code_block`, which makes the lookbook shell feel more like product UI without adding interaction yet.",
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
          values: "comma-separated fixed pixels, `auto`, and `rest`",
          description: "Assigns one track size per child, for example `\"260,rest\"`, `\"auto,rest\"`, or `\"rest,180\"`.",
        },
        {
          name: "surface",
          values: "`card` | `plain`",
          description: "Controls whether the split uses gapped card-style panes or full-space panes separated by dividers.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `screen` or `frame`",
          values: "one child layout tree",
          description: "A top-level container may host one nested layout node instead of its default placeholder content.",
        },
        {
          name: "`region label=\"...\"`",
          values: "temporary leaf placeholder",
          description: "Use `region` as a low-fidelity leaf or container. `surface=plain` removes the card chrome, `placeholder=false` suppresses fallback lines, `show_label=false` hides the region title chrome, and a region can host one nested `split` or content node such as `tree`, `stack`, `select`, `input`, `props`, or `code_block`.",
        },
      ],
      demos: [
        {
          id: "lookbook-skeleton",
          title: "Lookbook Skeleton",
          description: "A browser screen with a divider-separated sidebar tree, a preview area, and lower inspector panes with structured params and source.",
          markdown: [
            "```wireframe[980x700]",
            "screen lookbook title=\"Lookbook\" device=browser width=1366 height=820 surface=plain url=\"https://wireframe.md/lookbook\"",
            "  split axis=vertical sizes=\"auto,rest\" surface=plain",
            "    region label=\"Top Bar\" surface=plain placeholder=false",
            "    split axis=horizontal sizes=\"260,rest\" surface=plain",
            "      region label=\"Sidebar\" surface=plain show_label=false",
            "        tree",
            "          group label=\"Layout\"",
            "            item label=\"Screen\"",
            "            item label=\"Frame\"",
            "            item label=\"Split\"",
            "            item label=\"Region\"",
            "          group label=\"Navigation\"",
            "            item label=\"Tree\" selected=true",
            "            item label=\"Group\"",
            "            item label=\"Item\"",
            "      split axis=vertical sizes=\"rest,220\"",
            "        region label=\"Preview\"",
            "        split axis=horizontal sizes=\"320,rest\"",
            "          region label=\"Params\"",
            "            stack gap=14",
            "              select label=\"Device\" value=\"browser\" options=\"mobile,app,browser\"",
            "              select label=\"Surface\" value=\"plain\" options=\"card,plain\"",
            "              input label=\"URL\" type=\"url\" value=\"https://wireframe.md/lookbook\"",
            "          region label=\"Markdown\"",
            "            code_block language=\"wireframe\"",
            "              code_line \"screen lookbook title=\\\"Lookbook\\\" device=browser surface=plain\"",
            "              code_line \"  split axis=vertical sizes=\\\"auto,rest\\\" surface=plain\"",
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
    {
      id: "tree",
      name: "tree",
      summary: "A static navigation primitive for grouped example catalogs inside a region such as the lookbook sidebar.",
      notes: [
        "A `tree` lives inside a `region` and renders grouped, inspectable navigation content.",
        "`group` can contain more groups or items.",
        "`item selected=true` highlights the currently shown example, and `group expanded=false` renders a collapsed branch.",
      ],
      syntax: [
        "region label=\"Sidebar\" surface=plain show_label=false",
        "  tree",
        "    group label=\"Layout\"",
        "      item label=\"Screen\"",
        "      item label=\"Split\" selected=true",
      ],
      options: [
        {
          name: "region show_label",
          values: "`true` | `false`",
          description: "Controls whether the region chip and label are rendered. Defaults to `true`.",
        },
        {
          name: "group expanded",
          values: "`true` | `false`",
          description: "Controls whether a group renders its children. Defaults to `true`.",
        },
        {
          name: "item selected",
          values: "`true` | `false`",
          description: "Highlights the current example in a static, non-interactive way. Defaults to `false`.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `region`",
          values: "one content tree",
          description: "A region can host one nested `tree`, which makes sidebars and inspectors read more like product UI instead of labeled blank areas.",
        },
      ],
      demos: [
        {
          id: "sidebar-tree",
          title: "Sidebar Tree",
          description: "A grouped example catalog for a lookbook-style sidebar.",
          markdown: [
            "```wireframe[360x520]",
            "frame sidebar title=\"Elements\" width=320 height=460 surface=plain",
            "  region label=\"Catalog\" surface=plain show_label=false",
            "    tree",
            "      group label=\"Layout\"",
            "        item label=\"Screen\"",
            "        item label=\"Frame\"",
            "        item label=\"Split\"",
            "      group label=\"Navigation\"",
            "        item label=\"Tree\" selected=true",
            "        item label=\"Group\"",
            "        item label=\"Item\"",
            "```",
          ].join("\n"),
        },
        {
          id: "collapsed-tree-group",
          title: "Collapsed Group",
          description: "Groups can render as closed branches when only high-level structure should be visible.",
          markdown: [
            "```wireframe[360x420]",
            "frame sidebar title=\"Elements\" width=320 height=360 surface=plain",
            "  region label=\"Catalog\" surface=plain show_label=false",
            "    tree",
            "      group label=\"Layout\" expanded=false",
            "        item label=\"Screen\"",
            "      item label=\"Tree\" selected=true",
            "```",
          ].join("\n"),
        },
      ],
    },
    {
      id: "stack",
      name: "stack",
      summary: "A vertical composition primitive for multiple content blocks inside one region, such as a params list above supporting notes or a source panel.",
      notes: [
        "Use `stack` when one region needs more than one nested content block.",
        "A stack can currently contain other stacks, trees, selects, inputs, props lists, and code blocks.",
        "`gap` keeps spacing explicit in the DSL instead of burying layout assumptions in CSS.",
      ],
      syntax: [
        "region label=\"Inspector\"",
        "  stack gap=16",
        "    select label=\"Device\" value=\"browser\" options=\"mobile,app,browser\"",
        "    input label=\"URL\" type=\"url\" value=\"https://wireframe.md/lookbook\"",
        "    code_block language=\"wireframe\"",
        "      code_line \"screen lookbook\"",
      ],
      options: [
        {
          name: "gap",
          values: "number",
          description: "Vertical spacing between stacked children, in pixels. Defaults to `12`.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `region`",
          values: "one composed content tree",
          description: "A region still accepts one child, but `stack` lets that child compose multiple content blocks.",
        },
      ],
      demos: [
        {
          id: "stacked-inspector",
          title: "Stacked Inspector",
          description: "A single region can mix params and source snippets by nesting a stack.",
          markdown: [
            "```wireframe[520x460]",
            "frame inspect title=\"Inspector\" width=460 height=400",
            "  region label=\"Selection Details\"",
            "    stack gap=16",
            "      select label=\"Device\" value=\"browser\" options=\"mobile,app,browser\"",
            "      select label=\"Surface\" value=\"plain\" options=\"card,plain\"",
            "      input label=\"URL\" type=\"url\" value=\"https://wireframe.md/lookbook\"",
            "      code_block language=\"wireframe\"",
            "        code_line \"screen inspect title=\\\"Inspect\\\" device=browser\"",
            "```",
          ].join("\n"),
        },
      ],
    },
    {
      id: "props",
      name: "props",
      summary: "A static key-value list for inspector panes, parameter summaries, or compact metadata blocks.",
      notes: [
        "`props` renders structured rows instead of unlabeled placeholder bars.",
        "Each `prop` requires a `key` and `value`.",
        "This is a low-fidelity representation of a future params inspector, not an interactive form.",
      ],
      syntax: [
        "props",
        "  prop key=\"device\" value=\"browser\"",
        "  prop key=\"surface\" value=\"plain\"",
        "  prop key=\"url\" value=\"https://wireframe.md/lookbook\"",
      ],
      options: [
        {
          name: "prop key",
          values: "string",
          description: "The label column shown on the left side of the row.",
        },
        {
          name: "prop value",
          values: "string | number | boolean",
          description: "The rendered value shown on the right side of the row.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `region` or `stack`",
          values: "structured params list",
          description: "Use this for inspector-style metadata instead of a freeform placeholder region.",
        },
      ],
      demos: [
        {
          id: "params-list",
          title: "Params List",
          description: "Structured key-value rows for the selected example's current settings.",
          markdown: [
            "```wireframe[420x360]",
            "frame params title=\"Params\" width=360 height=300",
            "  region label=\"Selected Params\"",
            "    props",
            "      prop key=\"device\" value=\"browser\"",
            "      prop key=\"surface\" value=\"plain\"",
            "      prop key=\"placeholder\" value=false",
            "```",
          ].join("\n"),
        },
      ],
    },
    {
      id: "select",
      name: "select",
      summary: "A static dropdown-like control for params panes and inspector controls.",
      notes: [
        "`select` is visual only in the current DSL. It communicates a constrained choice without adding interaction yet.",
        "`options` is mainly descriptive today. The renderer uses `value` as the visible selection and keeps the full list available as metadata.",
        "This is a better fit than `prop` when the UI should read like a control rather than a summary row.",
      ],
      syntax: [
        "select label=\"Device\" value=\"browser\" options=\"mobile,app,browser\"",
        "select label=\"Surface\" value=\"plain\" options=\"card,plain\"",
      ],
      options: [
        {
          name: "label",
          values: "string",
          description: "Small field label shown above the select chrome.",
        },
        {
          name: "value",
          values: "string",
          description: "The current visible selection.",
        },
        {
          name: "options",
          values: "comma-separated string list",
          description: "Describes the available choices for the control.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `region` or `stack`",
          values: "static select control",
          description: "Use this for params panes when the UI should read like a dropdown rather than a property list.",
        },
      ],
      demos: [
        {
          id: "params-selects",
          title: "Static Select Controls",
          description: "A params pane with dropdown-like controls for constrained choices.",
          markdown: [
            "```wireframe[420x360]",
            "frame params title=\"Params\" width=360 height=300",
            "  region label=\"Selected Params\"",
            "    stack gap=14",
            "      select label=\"Device\" value=\"browser\" options=\"mobile,app,browser\"",
            "      select label=\"Surface\" value=\"plain\" options=\"card,plain\"",
            "```",
          ].join("\n"),
        },
      ],
    },
    {
      id: "input",
      name: "input",
      summary: "A static single-line input for longer freeform values such as URLs or labels.",
      notes: [
        "`input` is also visual only in the current DSL.",
        "This works well beside `select` controls in params panes.",
        "Use `type=\"url\"` when the value should read like an address or route.",
      ],
      syntax: [
        "input label=\"URL\" type=\"url\" value=\"https://wireframe.md/lookbook\"",
      ],
      options: [
        {
          name: "label",
          values: "string",
          description: "Small field label shown above the input chrome.",
        },
        {
          name: "value",
          values: "string",
          description: "The visible input value.",
        },
        {
          name: "type",
          values: "string",
          description: "Optional hint for styling variants such as `url`.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `region` or `stack`",
          values: "static text field",
          description: "Use this when the UI should read like a freeform field instead of a key-value row.",
        },
      ],
      demos: [
        {
          id: "url-input",
          title: "URL Input",
          description: "A params field for a longer URL value without forcing it into a two-column property row.",
          markdown: [
            "```wireframe[460x260]",
            "frame params title=\"Params\" width=400 height=200",
            "  region label=\"Selected Params\"",
            "    input label=\"URL\" type=\"url\" value=\"https://wireframe.md/lookbook\"",
            "```",
          ].join("\n"),
        },
      ],
    },
    {
      id: "code-block",
      name: "code_block",
      summary: "A read-only source snippet for showing the markdown or wireframe source behind a rendered example.",
      notes: [
        "`code_block` is intentionally static and presentation-focused.",
        "Use `code_line` children to preserve line breaks and indentation.",
        "This is a good fit for the lower markdown pane in the lookbook layout.",
      ],
      syntax: [
        "code_block language=\"wireframe\"",
        "  code_line \"screen lookbook title=\\\"Lookbook\\\" device=browser\"",
        "  code_line \"  region label=\\\"Preview\\\"\"",
      ],
      options: [
        {
          name: "language",
          values: "string",
          description: "Optional language tag shown above the snippet.",
        },
      ],
      blockOptions: [
        {
          name: "nested under `region` or `stack`",
          values: "read-only source display",
          description: "Use this when the showcase should reveal source without making the block editable.",
        },
      ],
      demos: [
        {
          id: "wireframe-source",
          title: "Wireframe Source",
          description: "A read-only source pane that mirrors the shape of the rendered example.",
          markdown: [
            "```wireframe[520x320]",
            "frame source title=\"Source\" width=460 height=260",
            "  region label=\"Markdown\"",
            "    code_block language=\"wireframe\"",
            "      code_line \"frame contact title=\\\"Contact Form\\\" width=480 height=360\"",
            "      code_line \"  region label=\\\"Form\\\"\"",
            "```",
          ].join("\n"),
        },
      ],
    },
  ],
};
