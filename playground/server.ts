import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// The playground: a page to edit a wireframe and see its render, diagnostics and
// summary, with a gallery of the examples in examples/ and their approvals. It
// serves the package's own sources, transpiled per request as
// test/screenshots/page.ts does, so nothing needs a build. A development tool,
// outside src and the package.
//
//   node playground/server.ts      (mise run playground)
//
// It listens on localhost only and writes nothing but example and approval files
// directly in examples/. Writes must come from its own page.

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PORT = 4610;
const FONT = join(ROOT, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2");

// Lowercase words joined by hyphens: no dots, slashes or anything a path could use.
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME = 64;
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

/** An approval file, with the source and markup as arrays of lines so its diffs read line by line. */
interface ApprovalFile {
  source: string[];
  stylesheet: string;
  markup: string[];
}

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
  const [, collection, name] = /^\/api\/(examples|approvals)(?:\/([^/]*))?$/.exec(pathname) ?? [];
  if (collection === undefined) throw new Refusal(404, `nothing at ${pathname}`);
  const route = `${method} ${collection}${name === undefined ? "" : "/NAME"}`;
  if (!["POST examples", "PUT examples/NAME", "PUT approvals/NAME"].includes(route)) {
    throw new Refusal(405, `${method} ${pathname} is not allowed`);
  }
  checkOrigin(request, host);
  const body = await readJson(request);
  if (route === "POST examples") return sendJson(response, 201, addExample(examples, body));
  if (route === "PUT examples/NAME") return sendJson(response, 200, saveExample(examples, name ?? "", body));
  return sendJson(response, 200, approve(examples, name ?? "", body));
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
 * The path of an example's file or its approval, directly in `examples`. A name
 * that isn't lowercase words joined by hyphens is refused, so no name reaches
 * outside the folder.
 */
function pathOf(examples: string, name: string, file: "example" | "approval"): string {
  if (!NAME.test(name) || name.length > MAX_NAME) {
    throw new Refusal(400, `refused the name "${name.slice(0, MAX_NAME)}": expected lowercase letters and digits joined by hyphens, at most ${MAX_NAME} characters`);
  }
  return join(examples, file === "example" ? `${name}.wireframe` : `${name}.approval.json`);
}

function read(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Every example by name, with its saved source and its approval, or null when it has none. */
function list(examples: string): { name: string; source: string; approval: unknown }[] {
  return readdirSync(examples)
    .filter((file) => file.endsWith(".wireframe") && NAME.test(file.slice(0, -".wireframe".length)))
    .sort()
    .map((file) => {
      const name = file.slice(0, -".wireframe".length);
      return { name, source: readFileSync(join(examples, file), "utf8"), approval: readApproval(examples, name) };
    });
}

function readApproval(examples: string, name: string): { source: string; stylesheet: string; markup: string } | null {
  const text = read(pathOf(examples, name, "approval"));
  if (text === undefined) return null;
  try {
    const { source, stylesheet, markup } = JSON.parse(text) as ApprovalFile;
    const lines = (value: unknown): value is string[] => Array.isArray(value) && value.every((line) => typeof line === "string");
    if (lines(source) && lines(markup) && typeof stylesheet === "string") {
      return { source: source.join("\n"), stylesheet, markup: markup.join("\n") };
    }
  } catch {
    // Reported below, like a file of the wrong shape.
  }
  console.warn(`examples/${name}.approval.json can't be read, so ${name} shows as not yet approved`);
  return null;
}

function addExample(examples: string, body: Record<string, unknown>): { name: string; source: string } {
  const name = string(body, "name");
  const source = string(body, "source");
  try {
    writeFileSync(pathOf(examples, name, "example"), source, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Refusal(409, `an example named ${name} exists`);
    throw error;
  }
  return { name, source };
}

function saveExample(examples: string, name: string, body: Record<string, unknown>): { name: string; source: string } {
  const path = pathOf(examples, name, "example");
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
function approve(examples: string, name: string, body: Record<string, unknown>): { source: string; stylesheet: string; markup: string } {
  const saved = read(pathOf(examples, name, "example"));
  if (saved === undefined) throw new Refusal(404, `no example named ${name}`);
  const source = string(body, "source");
  const stylesheet = string(body, "stylesheet");
  const markup = string(body, "markup");
  if (source !== saved) throw new Refusal(409, `the source differs from examples/${name}.wireframe: save it, then approve`);
  if (!FINGERPRINT.test(stylesheet)) throw new Refusal(400, "expected the stylesheet as sha256: and 64 hex digits");
  const file: ApprovalFile = { source: source.split("\n"), stylesheet, markup: markup.split("\n") };
  writeFileSync(pathOf(examples, name, "approval"), `${JSON.stringify(file, null, 2)}\n`);
  return { source, stylesheet, markup };
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
