import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { Approval } from "./approval.js";

// The playground: a page to edit a wireframe and see its render, diagnostics and
// summary, with a gallery of the examples in examples/ and their approvals. It
// serves the package's own sources, transpiled per request as
// test/screenshots/page.ts does, so nothing needs a build. A development tool,
// outside src and the package.
//
//   node playground/server.ts      (mise run playground)
//
// It listens on localhost only and writes nothing but example and approval files
// at examples/FAMILY/ENTRY/NAME.wireframe, or examples/approvals.json.
// Writes must come from its own page.

const ROOT = fileURLToPath(new URL("../", import.meta.url));
// Node strips TypeScript, but the package's .js import specifiers target its
// build. Resolve those specifiers to sources only within this development tool.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL !== undefined && specifier.endsWith(".js")) {
      const target = new URL(specifier, context.parentURL);
      const roots = [new URL("../src/", import.meta.url).href, new URL("./", import.meta.url).href];
      if (roots.some((root) => target.href.startsWith(root))) return nextResolve(target.href.replace(/\.js$/, ".ts"), context);
    }
    return nextResolve(specifier, context);
  },
});
const parserURL = new URL("../src/parse.js", import.meta.url).href;
const approvalURL = new URL("./approval.js", import.meta.url).href;
const catalogURL = new URL("./catalog.js", import.meta.url).href;
const { parseWireframe } = await import(parserURL) as typeof import("../src/parse.js");
const { approvalFingerprint } = await import(approvalURL) as typeof import("./approval.js");
const { compareNames, validName } = await import(catalogURL) as typeof import("./catalog.js");
const PORT = 4610;
const FONT = join(ROOT, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2");

// Generous for a source within the parser's 64,000 characters, its markup and fingerprint.
const MAX_BODY = 1_000_000;
const FINGERPRINT = /^sha256:[0-9a-f]{64}$/;

const STATIC: ReadonlyMap<string, { file: string; type: string }> = new Map([
  ["/", { file: join(ROOT, "playground/index.html"), type: "text/html; charset=utf-8" }],
  ["/playground.css", { file: join(ROOT, "playground/playground.css"), type: "text/css; charset=utf-8" }],
  // The bare page and the document column, as the screenshots have them.
  ["/hosts.css", { file: join(ROOT, "test/screenshots/hosts.css"), type: "text/css; charset=utf-8" }],
  ["/geist.woff2", { file: FONT, type: "font/woff2" }],
]);

class Refusal extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The playground's server, not yet listening. `examples` is the folder it reads
 * and writes, examples/ unless given.
 */
export function createPlayground(examples = join(ROOT, "examples")): Server {
  const server = createServer((request, response) => {
    handle(server, examples, request, response).catch((error: unknown) => {
      const status = error instanceof Refusal ? error.status : 500;
      if (status === 500) console.error(error);
      if (response.headersSent) response.end();
      else sendJson(response, status, { error: error instanceof Error ? error.message : String(error) });
    });
  });
  return server;
}

async function handle(server: Server, examples: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const host = checkHost(server, request);
  const { pathname } = new URL(request.url ?? "/", `http://${host}`);
  const method = request.method ?? "GET";

  if (method === "GET") {
    const file = STATIC.get(pathname);
    if (file !== undefined) return send(response, 200, file.type, readFileSync(file.file));
    // The browser's modules: the package's sources and the page's own, not this server.
    const module = /^\/(src|playground)\/([a-z]+)\.js$/.exec(pathname);
    if (module !== null && pathname !== "/playground/server.js") return sendModule(response, `${module[1]}/${module[2]}.ts`);
    if (pathname === "/api/examples") return sendJson(response, 200, { examples: list(examples) });
    throw new Refusal(404, `nothing at ${pathname}`);
  }

  // POST /api/examples adds an example, PUT /api/examples/NAME saves one, PUT /api/approvals/NAME approves one.
  const [, collection, name] = /^\/api\/(examples|approvals)(?:\/(.*))?$/.exec(pathname) ?? [];
  if (collection === undefined) throw new Refusal(404, `nothing at ${pathname}`);
  const route = `${method} ${collection}${name === undefined ? "" : "/NAME"}`;
  if (!["POST examples", "PUT examples/NAME", "PUT approvals/NAME"].includes(route)) {
    throw new Refusal(405, `${method} ${pathname} is not allowed`);
  }
  checkOrigin(request, host);
  const body = await readJson(request);
  if (route === "POST examples") return sendJson(response, 201, addExample(examples, body));
  if (route === "PUT examples/NAME") return sendJson(response, 200, saveExample(examples, name ?? "", body));
  return sendJson(response, 200, await approve(examples, name ?? "", body));
}

/** The request's Host, refused unless it names this server on loopback, so a rebound DNS name can't reach it. */
function checkHost(server: Server, request: IncomingMessage): string {
  const { port } = server.address() as AddressInfo;
  const host = request.headers.host ?? "";
  const allowed = ["localhost", "127.0.0.1", "[::1]"].map((name) => `${name}:${port}`);
  if (!allowed.includes(host)) throw new Refusal(403, `refused a request for host ${host || "(none)"}`);
  return host;
}

/** Refuse a write unless the page that sent it came from this server. */
function checkOrigin(request: IncomingMessage, host: string): void {
  const origin = request.headers.origin;
  if (origin !== `http://${host}`) throw new Refusal(403, `refused a write from origin ${origin ?? "(none)"}`);
  if (!(request.headers["content-type"] ?? "").startsWith("application/json")) {
    throw new Refusal(415, "expected a JSON body");
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let text = "";
  request.setEncoding("utf8");
  for await (const chunk of request) {
    text += chunk;
    if (text.length > MAX_BODY) throw new Refusal(413, `the body is over ${MAX_BODY.toLocaleString("en")} characters`);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Refusal(400, "the body is not JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Refusal(400, "expected a JSON object");
  return body as Record<string, unknown>;
}

function string(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string") throw new Refusal(400, `expected ${key} as a string`);
  return value;
}

/**
 * Only FAMILY/ENTRY/NAME is writable. Validation also defines what the list shows.
 */
function pathOf(examples: string, name: string): string {
  if (!validName(name)) {
    throw new Refusal(
      400,
      `refused the name "${name.slice(0, 194)}": expected FAMILY/ENTRY/NAME, each segment lowercase letters and digits joined by hyphens, at most 64 characters`,
    );
  }
  return join(examples, `${name}.wireframe`);
}

function read(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Only valid examples at the family/entry depth, with approvals read once. */
function list(examples: string): { name: string; source: string; approval: unknown }[] {
  const approvals = readApprovals(examples);
  return readdirSync(examples, { recursive: true, encoding: "utf8" })
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file.endsWith(".wireframe") && statSync(join(examples, file)).isFile())
    .map((file) => file.slice(0, -".wireframe".length))
    .filter(validName)
    .sort(compareNames)
    .map((name) => ({ name, source: readFileSync(pathOf(examples, name), "utf8"), approval: approvalOf(approvals[name]) }));
}

function readApprovals(examples: string): Record<string, unknown> {
  const text = read(join(examples, "approvals.json"));
  if (text === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Refuse writes too, so an unreadable file cannot lose other approvals.
  }
  throw new Refusal(409, "examples/approvals.json is not a JSON mapping; repair it before loading or approving examples");
}

function approvalOf(value: unknown): Approval | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.approved !== "boolean" || typeof entry.fingerprint !== "string" || !FINGERPRINT.test(entry.fingerprint)) return null;
  const approval: Approval = { approved: entry.approved, fingerprint: entry.fingerprint };
  if (typeof entry.markup === "string") approval.markup = entry.markup;
  if (typeof entry.stylesheet === "string") approval.stylesheet = entry.stylesheet;
  return approval;
}

function addExample(examples: string, body: Record<string, unknown>): { name: string; source: string } {
  const name = string(body, "name");
  const source = string(body, "source");
  const path = pathOf(examples, name);
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, source, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Refusal(409, `an example named ${name} exists`);
    throw error;
  }
  return { name, source };
}

function saveExample(examples: string, name: string, body: Record<string, unknown>): { name: string; source: string } {
  const path = pathOf(examples, name);
  const source = string(body, "source");
  if (read(path) === undefined) throw new Refusal(404, `no example named ${name}`);
  writeFileSync(path, source);
  return { name, source };
}

/**
 * Record what a person saw for an example's saved source. The page renders the
 * source and sends its markup; a source that isn't the one in the file, such as
 * unsaved edits, is refused.
 */
async function approve(examples: string, name: string, body: Record<string, unknown>): Promise<Approval> {
  const path = pathOf(examples, name);
  const saved = read(path);
  if (saved === undefined) throw new Refusal(404, `no example named ${name}`);
  const source = string(body, "source");
  const stylesheet = string(body, "stylesheet");
  const markup = string(body, "markup");
  if (source !== saved) throw new Refusal(409, `the source differs from examples/${name}.wireframe: save it, then approve`);
  if (!parseWireframe(saved).renderable) throw new Refusal(400, "fix the source's errors before approving");
  if (!FINGERPRINT.test(stylesheet)) throw new Refusal(400, "expected the stylesheet as sha256: and 64 hex digits");
  const fingerprint = await approvalFingerprint(source, stylesheet, markup);
  // The digest yields: recheck the source and read the mapping afterwards, so
  // concurrent approvals preserve each other and a concurrent save is refused.
  if (read(path) !== source) throw new Refusal(409, "the source changed while approving; reload and review it again");
  const approval: Approval = { approved: true, fingerprint, markup, stylesheet };
  const entries = { ...readApprovals(examples), [name]: approval };
  const sorted = Object.fromEntries(Object.keys(entries).sort().map((key) => [key, entries[key]]));
  writeFileSync(join(examples, "approvals.json"), `${JSON.stringify(sorted, null, 2)}\n`);
  return approval;
}

function sendModule(response: ServerResponse, path: string): void {
  const source = read(join(ROOT, path));
  if (source === undefined) throw new Refusal(404, `no module ${path}`);
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
  send(response, 200, "text/javascript; charset=utf-8", ts.transpileModule(source, { compilerOptions: options }).outputText);
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  send(response, status, "application/json", JSON.stringify(value));
}

function send(response: ServerResponse, status: number, type: string, body: string | Buffer): void {
  // Every request reads the files afresh, so a reload shows the current sources.
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(body);
}

/** Listen on localhost, on PORT or, when another process has it, any free port. */
export function listen(server: Server, port = PORT): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" && port !== 0) resolve(listen(server, 0));
      else reject(error);
    });
    server.listen(port, "localhost", () => {
      server.removeAllListeners("error");
      resolve(`http://localhost:${(server.address() as AddressInfo).port}/`);
    });
  });
}

if (import.meta.main) {
  const url = await listen(createPlayground());
  console.log(`The wireframe playground is at ${url}\nPress Ctrl+C to stop it.`);
}
