import { createServer } from "node:http";
import { existsSync, readFileSync, watch } from "node:fs";
import { extname, join, normalize } from "node:path";
import { buildSite, outDir, rootDir } from "./build-site.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const LIVE_RELOAD_PATH = "/__wireframe_md/live";
const WATCH_PATHS = [
  join(rootDir, "site"),
  join(rootDir, "scripts"),
  join(rootDir, "packages"),
];

const clients = new Set();
let rebuildTimer = null;

buildAndLog("startup");

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === LIVE_RELOAD_PATH) {
    handleSse(request, response);
    return;
  }

  const filePath = resolveFilePath(url.pathname);
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const raw = readFileSync(filePath);
  const type = contentType(filePath);

  response.writeHead(200, { "content-type": type });

  if (type.startsWith("text/html")) {
    response.end(injectLiveReload(raw.toString("utf8")));
    return;
  }

  response.end(raw);
});

server.listen(PORT, HOST, () => {
  console.log(`[wireframe-md] dev site running at http://${HOST}:${PORT}`);
});

const watchers = WATCH_PATHS.map((watchPath) =>
  watch(watchPath, { recursive: true }, (_eventType, filename) => {
    if (!filename || shouldIgnore(filename)) return;
    scheduleRebuild(filename);
  }),
);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function handleSse(request, response) {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  response.write("retry: 300\n\n");

  clients.add(response);

  request.on("close", () => {
    clients.delete(response);
  });
}

function resolveFilePath(pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const resolved = join(outDir, normalized);

  if (!resolved.startsWith(outDir)) {
    return null;
  }

  return resolved;
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function injectLiveReload(html) {
  const snippet = [
    "<script>",
    `(() => {`,
    `  const source = new EventSource("${LIVE_RELOAD_PATH}");`,
    `  source.addEventListener("reload", () => window.location.reload());`,
    `})();`,
    "</script>",
  ].join("");

  return html.includes("</body>") ? html.replace("</body>", `${snippet}</body>`) : `${html}${snippet}`;
}

function scheduleRebuild(filename) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    buildAndLog(filename);
    broadcastReload();
  }, 75);
}

function buildAndLog(reason) {
  try {
    buildSite();
    console.log(`[wireframe-md] rebuilt site (${reason})`);
  } catch (error) {
    console.error("[wireframe-md] site build failed");
    console.error(error);
  }
}

function broadcastReload() {
  clients.forEach((response) => {
    response.write("event: reload\ndata: now\n\n");
  });
}

function shouldIgnore(filename) {
  return filename.includes("site-dist") || filename.includes(".git") || filename.includes("node_modules");
}

function shutdown() {
  watchers.forEach((entry) => entry.close());
  clients.forEach((response) => response.end());
  server.close(() => process.exit(0));
}
