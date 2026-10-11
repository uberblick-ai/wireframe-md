import { describe, expect, it } from "vitest";
import { compareFolders, compareNames, folderLabel, validName } from "../playground/catalog.js";

describe("the playground catalog", () => {
  it.each(["a", "a/b", "a/b/c/d", "a/Bad/c", "a/b/--", "a/b/.hidden", `a/${"x".repeat(65)}/c`])("refuses %s", (name) => {
    expect(validName(name)).toBe(false);
  });
  it("accepts only three bounded segments", () => {
    expect(validName(`forms/1-basic-inputs/${"x".repeat(64)}`)).toBe(true);
  });
  it("sorts numbers numerically before alphabetic folders, with deterministic ties", () => {
    expect(["z", "10-complex", "2-simple", "1-basic", "a", "01-b", "01-a"].sort(compareFolders)).toEqual(["01-a", "01-b", "1-basic", "2-simple", "10-complex", "a", "z"]);
  });
  it("orders families, entries, then example names without interpreting example numbers", () => {
    expect(["forms/10-complex/z", "forms/2-simple/2-b", "forms/2-simple/10-a", "1-tables/basic/z"].sort(compareNames)).toEqual(["1-tables/basic/z", "forms/2-simple/10-a", "forms/2-simple/2-b", "forms/10-complex/z"]);
  });
  it("hides ordering numbers and retains the existing label convention", () => {
    expect(folderLabel("1-basic-inputs")).toBe("Basic inputs");
    expect(folderLabel("banners-and-confirmations")).toBe("Banners & confirmations");
  });
});
