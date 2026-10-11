// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approvalFingerprint } from "../playground/approval.js";
import { createPlayground, listen } from "../playground/server.js";

// The playground's server, on a scratch examples folder: what it serves, what it
// writes, and the writes it refuses.

const BANNER = "banner\n  text Hello\n";
const FINGERPRINT = `sha256:${"a".repeat(64)}`;

let scratch = "";
let folder = "";
let server: Server;
let port = 0;

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), "wireframe-playground-"));
  folder = join(scratch, "examples");
  mkdirSync(join(folder, "banners/basic"), { recursive: true });
  writeFileSync(join(folder, "banners/basic/banner.wireframe"), BANNER);
  server = createPlayground(folder);
  port = Number(new URL(await listen(server, 0)).port);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(scratch, { recursive: true, force: true });
});

interface Call {
  body?: unknown;
  host?: string;
  /** The page's own origin unless given; null sends none. */
  origin?: string | null;
  type?: string;
}

interface Listed {
  examples: { name: string; source: string; approval: unknown }[];
}

function call(method: string, path: string, options: Call = {}): Promise<{ status: number; text: string; json: <T>() => T }> {
  const { body, host = `localhost:${port}`, origin = `http://localhost:${port}`, type = "application/json" } = options;
  const headers: Record<string, string> = { host, "content-type": type };
  if (origin !== null) headers.origin = origin;
  return new Promise((resolve, reject) => {
    const sent = request({ hostname: "localhost", port, path, method, headers }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        text += chunk;
      });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, text, json: () => JSON.parse(text) }));
    });
    sent.on("error", reject);
    sent.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

const read = (file: string): string => readFileSync(join(folder, file), "utf8");

describe("the playground's server", () => {
  it("serves the page, its modules and the package's sources, transpiled", async () => {
    expect((await call("GET", "/")).text).toContain('<script type="module" src="/playground/app.js">');
    expect((await call("GET", "/playground/app.js")).text).toContain('from "../src/index.js"');
    const index = await call("GET", "/src/index.js");
    expect(index.text).toContain('export { parseWireframe } from "./parse.js"');
    expect(index.text).not.toContain("export type");
    expect((await call("GET", "/hosts.css")).text).toContain(".column");
  });

  it("doesn't serve itself or anything outside its list", async () => {
    expect((await call("GET", "/playground/server.js")).status).toBe(404);
    expect((await call("GET", "/package.json")).status).toBe(404);
    expect((await call("GET", "/src/..%2Fpackage.js")).status).toBe(404);
  });

  it("lists the examples with their saved sources", async () => {
    const response = await call("GET", "/api/examples");
    expect(response.json()).toEqual({ examples: [{ name: "banners/basic/banner", source: BANNER, approval: null }] });
  });

  it("refuses a request for any host but itself on loopback", async () => {
    expect((await call("GET", "/api/examples", { host: `wireframe.example:${port}` })).status).toBe(403);
    expect((await call("GET", "/", { host: "localhost:1" })).status).toBe(403);
    expect((await call("GET", "/", { host: `127.0.0.1:${port}` })).status).toBe(200);
  });

  it("saves an example", async () => {
    const source = "banner.info\n  text Saved\n";
    const response = await call("PUT", "/api/examples/banners/basic/banner", { body: { source } });
    expect(response.status).toBe(200);
    expect(read("banners/basic/banner.wireframe")).toBe(source);
    await call("PUT", "/api/examples/banners/basic/banner", { body: { source: BANNER } });
  });

  it("adds an example, but never over one", async () => {
    const response = await call("POST", "/api/examples", { body: { name: "dialogs/basic/new-dialog-2", source: "dialog New" } });
    expect(response.status).toBe(201);
    expect(read("dialogs/basic/new-dialog-2.wireframe")).toBe("dialog New");
    const again = await call("POST", "/api/examples", { body: { name: "banners/basic/banner", source: "dialog Over" } });
    expect(again.status).toBe(409);
    expect(read("banners/basic/banner.wireframe")).toBe(BANNER);
  });

  it("refuses to save an example that doesn't exist", async () => {
    expect((await call("PUT", "/api/examples/dialogs/basic/missing", { body: { source: "dialog" } })).status).toBe(404);
  });

  it.each(["name", "family/name", "a/Bad/c", "a/b/bad--name", "../escape", "..", "a/b/c/d", "/a", "a/", "../a", "a/../b", "a\\b", ".hidden", "Upper", "trailing-", "x.wireframe", "", `a/b/${"a".repeat(65)}`])(
    "refuses the name %j",
    async (name) => {
      expect((await call("POST", "/api/examples", { body: { name, source: "dialog" } })).status).toBe(400);
    },
  );

  it.each(["/api/examples/..%2Fescape", "/api/approvals/..%2F..%2Fpackage", "/api/approvals/a%2Fb", "/api/examples/.hidden"])(
    "refuses the path %s",
    async (path) => {
      expect((await call("PUT", path, { body: { source: BANNER, markup: "", stylesheet: FINGERPRINT } })).status).toBe(400);
    },
  );

  it.each([
    ["another origin", { origin: "http://wireframe.example" }],
    ["no origin", { origin: null }],
    ["the right host on another port", { origin: "http://localhost:1" }],
  ])("refuses a write from %s", async (_, options) => {
    const response = await call("PUT", "/api/examples/banners/basic/banner", { ...options, body: { source: "dialog Hijacked" } });
    expect(response.status).toBe(403);
    expect(read("banners/basic/banner.wireframe")).toBe(BANNER);
  });

  it("refuses a write that isn't JSON", async () => {
    expect((await call("PUT", "/api/examples/banners/basic/banner", { type: "text/plain", body: { source: "x" } })).status).toBe(415);
    expect(read("banners/basic/banner.wireframe")).toBe(BANNER);
  });

  it("refuses an approval of anything but the saved source", async () => {
    const body = { source: "banner\n  text Unsaved\n", markup: "<div>", stylesheet: FINGERPRINT };
    const response = await call("PUT", "/api/approvals/banners/basic/banner", { body });
    expect(response.status).toBe(409);
    expect(response.json<{ error: string }>().error).toContain("save it, then approve");
  });

  it("refuses an approval without a fingerprint, or of a missing example", async () => {
    expect((await call("PUT", "/api/approvals/banners/basic/banner", { body: { source: BANNER, markup: "<div>", stylesheet: "x" } })).status).toBe(400);
    expect((await call("PUT", "/api/approvals/dialogs/basic/missing", { body: { source: BANNER, markup: "", stylesheet: FINGERPRINT } })).status).toBe(404);
  });

  it("records approvals in one sorted mapping, preserving other entries", async () => {
    const markup = "<div>\n  <span>Hello</span>\n</div>";
    const response = await call("PUT", "/api/approvals/banners/basic/banner", { body: { source: BANNER, markup, stylesheet: FINGERPRINT } });
    const approval = { approved: true, fingerprint: await approvalFingerprint(BANNER, FINGERPRINT, markup), markup, stylesheet: FINGERPRINT };
    expect(response.status).toBe(200);
    expect(response.json()).toEqual(approval);
    expect(JSON.parse(read("approvals.json"))).toEqual({ "banners/basic/banner": approval });
    const listed = (await call("GET", "/api/examples")).json<Listed>().examples;
    expect(listed.find((example) => example.name === "banners/basic/banner")).toEqual({ name: "banners/basic/banner", source: BANNER, approval });
    const body = { source: "dialog New", stylesheet: FINGERPRINT, markup: "<div>New</div>" };
    expect((await call("PUT", "/api/approvals/dialogs/basic/new-dialog-2", { body })).status).toBe(200);
    expect(Object.keys(JSON.parse(read("approvals.json")))).toEqual(["banners/basic/banner", "dialogs/basic/new-dialog-2"]);
    expect(JSON.parse(read("approvals.json"))["banners/basic/banner"]).toEqual(approval);
    expect(read("approvals.json")).toContain("\n  ");
  });

  it("adds in new family and entry folders, and lists by family/entry/name", async () => {
    expect((await call("POST", "/api/examples", { body: { name: "new-family/new-entry/settings", source: "dialog Settings" } })).status).toBe(201);
    expect(read("new-family/new-entry/settings.wireframe")).toBe("dialog Settings");
    expect((await call("PUT", "/api/examples/new-family/new-entry/settings", { body: { source: "dialog Prefs" } })).status).toBe(200);
    const listed = (await call("GET", "/api/examples")).json<Listed>().examples;
    expect(listed.find((example) => example.name === "new-family/new-entry/settings")).toEqual({ name: "new-family/new-entry/settings", source: "dialog Prefs", approval: null });
  });

  it("does not list invalid depths or segments", async () => {
    for (const name of ["ungrouped", "forms/input", "a/b/c/d", "a/Bad/c", `a/b/${"x".repeat(65)}`]) {
      const path = join(folder, `${name}.wireframe`);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "page");
    }
    const listed = (await call("GET", "/api/examples")).json<Listed>().examples;
    expect(listed.map((example) => example.name)).toEqual(["banners/basic/banner", "dialogs/basic/new-dialog-2", "new-family/new-entry/settings"]);
  });

  it("refuses to approve a saved source with an error", async () => {
    const source = "dialog \"Unclosed";
    await call("PUT", "/api/examples/new-family/new-entry/settings", { body: { source } });
    const response = await call("PUT", "/api/approvals/new-family/new-entry/settings", { body: { source, markup: "", stylesheet: FINGERPRINT } });
    expect(response.status).toBe(400);
    expect(JSON.parse(read("approvals.json"))["new-family/new-entry/settings"]).toBeUndefined();
  });

  it("refuses a malformed mapping without overwriting it", async () => {
    const original = read("approvals.json");
    writeFileSync(join(folder, "approvals.json"), "{");
    expect((await call("PUT", "/api/approvals/banners/basic/banner", { body: { source: BANNER, markup: "", stylesheet: FINGERPRINT } })).status).toBe(409);
    expect(read("approvals.json")).toBe("{");
    writeFileSync(join(folder, "approvals.json"), original);
  });

  it("reads minimal fingerprints, approved false and malformed individual entries", async () => {
    const original = read("approvals.json");
    writeFileSync(join(folder, "approvals.json"), JSON.stringify({
      "banners/basic/banner": { approved: false, fingerprint: FINGERPRINT },
      "dialogs/basic/new-dialog-2": { approved: true, fingerprint: FINGERPRINT },
      "new-family/new-entry/settings": { approved: true, fingerprint: "invalid" },
    }));
    const listed = (await call("GET", "/api/examples")).json<Listed>().examples;
    expect(listed.map((example) => example.approval)).toEqual([{ approved: false, fingerprint: FINGERPRINT }, { approved: true, fingerprint: FINGERPRINT }, null]);
    writeFileSync(join(folder, "approvals.json"), original);
  });

  it("writes approvals only to the single file in its examples folder", () => {
    expect(readdirSync(scratch)).toEqual(["examples"]);
    expect(readdirSync(folder, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".approval.json"))).toEqual([]);
    expect(readdirSync(folder).filter((file) => file.endsWith(".json"))).toEqual(["approvals.json"]);
  });

  it("listens on another port when its own is taken", async () => {
    const other = createPlayground(folder);
    const url = await listen(other, port);
    expect(url).toMatch(/^http:\/\/localhost:\d+\/$/);
    expect(url).not.toBe(`http://localhost:${port}/`);
    await new Promise<void>((resolve) => other.close(() => resolve()));
  });
});
