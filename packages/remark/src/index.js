import { parseFenceInfo } from "@wireframe-md/core";
import { getDefaultStyles, renderWireframeBlockToHtml } from "@wireframe-md/html";
import { visit } from "unist-util-visit";

export function remarkWireframeMd(options = {}) {
  const injectStyles = options.injectStyles === true;

  return function transformer(tree) {
    let stylesInjected = false;

    visit(tree, "code", (node, index, parent) => {
      if (!parent || index == null) return;

      const info = parseFenceInfo([node.lang || "", node.meta || ""].filter(Boolean).join(" "));
      if (info.language !== "wireframe") return;

      const replacements = [];

      if (injectStyles && !stylesInjected) {
        replacements.push({
          type: "html",
          value: `<style>${getDefaultStyles()}</style>`,
        });
        stylesInjected = true;
      }

      replacements.push({
        type: "html",
        value: renderWireframeBlockToHtml(node.value, info.options),
      });

      parent.children.splice(index, 1, ...replacements);
      return index + replacements.length;
    });
  };
}

export default remarkWireframeMd;
