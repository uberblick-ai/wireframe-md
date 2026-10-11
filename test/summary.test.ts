import { describe, expect, it } from "vitest";
import { parseWireframe, summarizeWireframe } from "../src/index.js";
import { archivedBanner, cardBlock, deleteConfirmation, documentList, figmaPrivate, figmaReading } from "./samples.js";

const summary = (source: string): string => summarizeWireframe(parseWireframe(source));

describe("summarizeWireframe", () => {
  it("names a top-level card by its first title, or its first text without a title", () => {
    expect(summary(cardBlock)).toBe("Wireframe: card “Let the launcher install dependencies”");
    expect(summary("card\n  text Label\n  text.title First title\n  text.title Second title")).toBe("Wireframe: card “First title”");
    expect(summary("card\n  text Body\n  text Footer")).toBe("Wireframe: card “Body”");
    expect(summary("card\n  text.title Title\ncard\n  text Second card")).toBe("Wireframe: card “Title”; card “Second card”");
    expect(summary("card")).toBe("Wireframe: card");
  });

  it("names the dialog's question and the banner's message", () => {
    expect(summary(deleteConfirmation)).toBe("Wireframe: dialog “Delete “Q3 launch draft”?”");
    expect(summary(archivedBanner)).toBe(
      "Wireframe: warning banner “Archived. Read-only and hidden from the document list.”",
    );
  });

  it("names a page by its title, its first text", () => {
    expect(summary(documentList)).toBe("Wireframe: page “All documents”");
    expect(summary("page\n  input Search titles")).toBe("Wireframe: page");
  });

  it("does not name a root by text in a row", () => {
    expect(summary("page\n  row.end\n    text.muted 1–10 of 24\n    button Next")).toBe("Wireframe: page");
    expect(summary("page\n  row\n    text.title In a row\n  text Direct text")).toBe("Wireframe: page “Direct text”");
  });

  it("names a frame by its caption label, without falling back to body text", () => {
    expect(summary(figmaReading)).toBe("Wireframe: frame “Figma · Payment, mobile”");
    expect(summary(figmaPrivate)).toBe("Wireframe: frame “Figma · Checkout flow”");
    expect(summary("frame\n  text Body")).toBe("Wireframe: frame");
  });

  it("names each root in order", () => {
    expect(summary(`${deleteConfirmation}\n${archivedBanner}`)).toBe(
      "Wireframe: dialog “Delete “Q3 launch draft”?”; warning banner “Archived. Read-only and hidden from the document list.”",
    );
  });

  it("uses a root's label, or else its first text with a label", () => {
    expect(summary("dialog\n  icon archive\n  text\n  text Body\n  text Second")).toBe("Wireframe: dialog “Body”");
    expect(summary("banner Label\n  text Body")).toBe("Wireframe: banner “Label”");
    expect(summary("dialog\n  row\n    button OK")).toBe("Wireframe: dialog");
  });

  it("names a banner's tone, the strongest when there are several", () => {
    expect(summary("banner\n  text Hi")).toBe("Wireframe: banner “Hi”");
    expect(summary("banner.neutral\n  text Hi")).toBe("Wireframe: banner “Hi”");
    expect(summary("banner.info\n  text Hi")).toBe("Wireframe: info banner “Hi”");
    expect(summary("banner.success\n  text Restored")).toBe("Wireframe: success banner “Restored”");
    expect(summary("banner.success.danger\n  text Hi")).toBe("Wireframe: danger banner “Hi”");
    expect(summary("banner.success.info\n  text Hi")).toBe("Wireframe: info banner “Hi”");
    expect(summary("banner.danger\n  text Hi")).toBe("Wireframe: danger banner “Hi”");
    expect(summary("banner.danger.info\n  text Hi")).toBe("Wireframe: danger banner “Hi”");
    expect(summary("banner.purple\n  text Hi")).toBe("Wireframe: banner “Hi”");
  });

  it("names other roots by their kind as written", () => {
    expect(summary("card Settings\n  text Body")).toBe("Wireframe: card “Settings”");
    expect(summary(".muted Hi")).toBe("Wireframe: unnamed node “Hi”");
    expect(summary("row\n  button Go\ntext Note\nicon archive")).toBe(
      "Wireframe: row; text “Note”; icon “archive”",
    );
  });

  it("keeps labels as written, on one line", () => {
    expect(summary("dialog <b>**Hi**</b>")).toBe("Wireframe: dialog “<b>**Hi**</b>”");
    expect(summary("dialog One Two\u0085Three\u000bFour")).toBe("Wireframe: dialog “One Two Three Four”");
  });

  it("says when there is nothing to draw", () => {
    expect(summary("")).toBe("Empty wireframe");
    expect(summary("dialog\n   text Odd")).toBe("Wireframe with errors");
  });
});
