# wireframe-md

A small text format for wireframes, rendered as clean, themed HTML. Agents write
it in a few lines; people see a wireframe. It is published as
`@uberblick/wireframe` and is built first for
[Uberblick](https://github.com/uberblick-ai/uberblick-2) documents, where a
```` ```wireframe ```` code block shows as a live preview.

````markdown
```wireframe
dialog Delete “Q3 launch draft”?
  text It will be gone for everyone, with its comments and history. This can't be undone.
  row.end
    button.focus Cancel
    button.danger Delete
```
````

Throughout 0.x the format may change in any minor version;
[CHANGELOG.md](CHANGELOG.md) says what changed.

## Install

```sh
pnpm add @uberblick/wireframe
```

An ES module with type declarations and no runtime dependencies. Rendering needs
a DOM and a browser with CSS `light-dark()` and `color-mix()`.

## Usage

```ts
import { parseWireframe, renderWireframe, summarizeWireframe } from "@uberblick/wireframe";
import "@uberblick/wireframe/styles.css";

const result = parseWireframe(source); // the block's body, without its fences
for (const { line, severity, message } of result.diagnostics) console.warn(`line ${line}: ${severity}: ${message}`);

const wireframe = renderWireframe(result); // null when there is an error
if (wireframe !== null) figure.replaceChildren(wireframe);
figure.setAttribute("aria-label", summarizeWireframe(result));
```

`parseWireframe` never throws: warnings still draw, errors don't. The output is
static, inert DOM, and every style rule sits under `.wf-root`. Without a CSS
bundler, `getEmbedStyles()` returns the same stylesheet as a string.

## More

- [AUTHORING.md](AUTHORING.md): the format, every kind and the common mistakes.
  Agents read this before writing a block; it ships as
  `@uberblick/wireframe/AUTHORING.md`.
- [THEMING.md](THEMING.md): the `--wf-*` properties and mapping a host's tokens.
- [playground/README.md](playground/README.md): the local playground and example
  approval, for working on this repository.

## Credits

The format borrows ideas from [Wireloom](https://www.npmjs.com/package/wireloom)
(MIT, © 2026 Brad Wardell). Any code taken from it is listed in
`THIRD_PARTY_NOTICES.md`.

## Licence

MIT
