// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  mkdirSync(folder);
  writeFileSync(join(folder, "banner.wireframe"), BANNER);
  server = createPlayground(folder);
  port = Number(new URL(await listen(server, 0)).port);
});

afterAll(() => {
  server.close();
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
    expect(response.json()).toEqual({ examples: [{ name: "banner", source: BANNER, approval: null }] });
  });

  it("refuses a request for any host but itself on loopback", async () => {
    expect((await call("GET", "/api/examples", { host: `wireframe.example:${port}` })).status).toBe(403);
    expect((await call("GET", "/", { host: "localhost:1" })).status).toBe(403);
    expect((await call("GET", "/", { host: `127.0.0.1:${port}` })).status).toBe(200);
  });

  it("saves an example", async () => {
    const source = "banner.info\n  text Saved\n";
    const response = await call("PUT", "/api/examples/banner", { body: { source } });
    expect(response.status).toBe(200);
    expect(read("banner.wireframe")).toBe(source);
    await call("PUT", "/api/examples/banner", { body: { source: BANNER } });
  });

  it("adds an example, but never over one", async () => {
    const response = await call("POST", "/api/examples", { body: { name: "new-dialog-2", source: "dialog New" } });
    expect(response.status).toBe(201);
    expect(read("new-dialog-2.wireframe")).toBe("dialog New");
    const again = await call("POST", "/api/examples", { body: { name: "banner", source: "dialog Over" } });
    expect(again.status).toBe(409);
    expect(read("banner.wireframe")).toBe(BANNER);
  });

  it("refuses to save an example that doesn't exist", async () => {
    expect((await call("PUT", "/api/examples/missing", { body: { source: "dialog" } })).status).toBe(404);
  });

  it.each(["../escape", "..", "a/b/c", "/a", "a/", "../a", "a/../b", "a\\b", ".hidden", "Upper", "trailing-", "x.wireframe", "", "a".repeat(65)])(
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
    const response = await call("PUT", "/api/examples/banner", { ...options, body: { source: "dialog Hijacked" } });
    expect(response.status).toBe(403);
    expect(read("banner.wireframe")).toBe(BANNER);
  });

  it("refuses a write that isn't JSON", async () => {
    expect((await call("PUT", "/api/examples/banner", { type: "text/plain", body: { source: "x" } })).status).toBe(415);
    expect(read("banner.wireframe")).toBe(BANNER);
  });

  it("refuses an approval of anything but the saved source", async () => {
    const body = { source: "banner\n  text Unsaved\n", markup: "<div>", stylesheet: FINGERPRINT };
    const response = await call("PUT", "/api/approvals/banner", { body });
    expect(response.status).toBe(409);
    expect(response.json<{ error: string }>().error).toContain("save it, then approve");
  });

  it("refuses an approval without a fingerprint, or of a missing example", async () => {
    expect((await call("PUT", "/api/approvals/banner", { body: { source: BANNER, markup: "<div>", stylesheet: "x" } })).status).toBe(400);
    expect((await call("PUT", "/api/approvals/missing", { body: { source: BANNER, markup: "", stylesheet: FINGERPRINT } })).status).toBe(404);
  });

  it("records an approval next to the example, with its lines readable in a diff", async () => {
    const markup = '<div class="wf-root">\n  <div class="wf-banner">\n</div>';
    const response = await call("PUT", "/api/approvals/banner", { body: { source: BANNER, markup, stylesheet: FINGERPRINT } });
    expect(response.status).toBe(200);
    expect(JSON.parse(read("banner.approval.json"))).toEqual({
      source: ["banner", "  text Hello", ""],
      stylesheet: FINGERPRINT,
      markup: ['<div class="wf-root">', '  <div class="wf-banner">', "</div>"],
    });
    const listed = (await call("GET", "/api/examples")).json<Listed>().examples[0];
    expect(listed).toEqual({ name: "banner", source: BANNER, approval: { source: BANNER, stylesheet: FINGERPRINT, markup } });
  });

  it("adds an example to a group, making its folder, and lists it by group/name", async () => {
    const response = await call("POST", "/api/examples", { body: { name: "dialogs/settings", source: "dialog Settings" } });
    expect(response.status).toBe(201);
    expect(read("dialogs/settings.wireframe")).toBe("dialog Settings");
    expect((await call("PUT", "/api/examples/dialogs/settings", { body: { source: "dialog Prefs" } })).status).toBe(200);
    const markup = '<div class="wf-root"></div>';
    const approved = await call("PUT", "/api/approvals/dialogs/settings", { body: { source: "dialog Prefs", markup, stylesheet: FINGERPRINT } });
    expect(approved.status).toBe(200);
    const listed = (await call("GET", "/api/examples")).json<Listed>().examples;
    expect(listed.find((example) => example.name === "dialogs/settings")).toEqual({
      name: "dialogs/settings",
      source: "dialog Prefs",
      approval: { source: "dialog Prefs", stylesheet: FINGERPRINT, markup },
    });
  });

  it("lists an unreadable approval as none", async () => {
    writeFileSync(join(folder, "new-dialog-2.approval.json"), "{");
    const listed = (await call("GET", "/api/examples")).json<Listed>().examples;
    expect(listed.find((example) => example.name === "new-dialog-2")).toEqual({
      name: "new-dialog-2",
      source: "dialog New",
      approval: null,
    });
  });

  it("has written only example and approval files, in its folder and a group folder", () => {
    expect(readdirSync(scratch)).toEqual(["examples"]);
    expect(readdirSync(folder).sort()).toEqual([
      "banner.approval.json",
      "banner.wireframe",
      "dialogs",
      "new-dialog-2.approval.json",
      "new-dialog-2.wireframe",
    ]);
    expect(readdirSync(join(folder, "dialogs")).sort()).toEqual(["settings.approval.json", "settings.wireframe"]);
  });

  it("listens on another port when its own is taken", async () => {
    const other = createPlayground(folder);
    const url = await listen(other, port);
    expect(url).toMatch(/^http:\/\/localhost:\d+\/$/);
    expect(url).not.toBe(`http://localhost:${port}/`);
    other.close();
  });
});
