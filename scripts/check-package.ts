import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Checks the package as a user gets it. Packs it as npm publish would, or takes
// a tarball the release workflow already packed, checks what the tarball and
// its package.json hold, installs it into a scratch project and checks that the
// API, its types and the stylesheet resolve there. Build first.
//
//   node scripts/check-package.ts [TARBALL]

const NAME = "@uberblick/wireframe";
const API = ["getEmbedStyles", "parseWireframe", "renderWireframe", "summarizeWireframe"];
const EXPORTS = [".", "./styles.css"];
// Besides dist's modules and declarations, the tarball holds these files and nothing else.
const REQUIRED = ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "dist/index.js", "dist/index.d.ts", "dist/styles.css"];
const OPTIONAL = ["THIRD_PARTY_NOTICES.md"];

// A consumer's TypeScript, compiled against the installed declarations.
const CONSUMER = `import {
  getEmbedStyles,
  parseWireframe,
  renderWireframe,
  summarizeWireframe,
  type WireframeAttribute,
  type WireframeDiagnostic,
  type WireframeNode,
  type WireframeParseResult,
} from "${NAME}";

const result: WireframeParseResult = parseWireframe("dialog Title");
const nodes: WireframeNode[] = result.nodes;
const diagnostics: WireframeDiagnostic[] = result.diagnostics;
const attributes: WireframeAttribute[] = nodes.flatMap((node) => node.attributes);
const element: HTMLElement | null = renderWireframe(result, document);
const summary: string = summarizeWireframe(result);
const styles: string = getEmbedStyles();
export { attributes, diagnostics, element, styles, summary };
`;

// How a consumer may resolve the package: as Node does, or as a bundler does.
const RESOLUTIONS: Record<string, ts.CompilerOptions> = {
  nodenext: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
  bundler: { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
};

const root = resolve(import.meta.dirname, "..");
const problems: string[] = [];
const expect = (ok: boolean, problem: string): void => {
  if (!ok) problems.push(problem);
};

function run(command: string, args: string[], cwd: string): { stdout: string; stderr: string } {
  const { status, stdout, stderr, error } = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${error?.message ?? ""}\n${stderr}${stdout}`);
  return { stdout, stderr };
}

// Packs into an empty directory and takes the one tarball there, since the shape
// of `npm pack --json` differs between npm 11 and 12.
function pack(into: string): string {
  run("npm", ["pack", "--pack-destination", into], root);
  const tarballs = readdirSync(into).filter((name) => name.endsWith(".tgz"));
  const [tarball] = tarballs;
  if (tarball === undefined || tarballs.length > 1) throw new Error(`npm pack left ${tarballs.length} tarballs in ${into}, expected one`);
  return join(into, tarball);
}

function checkTarball(tarball: string): void {
  const files = run("tar", ["-tzf", tarball], root)
    .stdout.trim()
    .split("\n")
    .map((entry) => entry.replace(/^package\//, ""));
  for (const file of files) {
    const allowed = REQUIRED.includes(file) || OPTIONAL.includes(file) || /^dist\/[\w/-]+\.(js|d\.ts)$/.test(file);
    expect(allowed, `the tarball holds ${file}; only the build, package.json and the docs belong in it`);
  }
  for (const file of REQUIRED) expect(files.includes(file), `the tarball lacks ${file}`);

  const manifest = JSON.parse(run("tar", ["-xzOf", tarball, "package/package.json"], root).stdout);
  expect(manifest.name === NAME, `package.json names ${manifest.name}, expected ${NAME}`);
  expect(!("private" in manifest), "package.json is marked private");
  expect(manifest.license === "MIT", `package.json gives the licence as ${manifest.license}, expected MIT`);
  expect(manifest.type === "module", "package.json doesn't declare an ES module package");
  expect(manifest.publishConfig?.access === "public", "package.json doesn't publish with public access");
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies", "bundleDependencies"]) {
    expect(!(field in manifest), `package.json has ${field}; the package has no runtime dependencies`);
  }
  // The repository's own Node lives in mise.toml and devEngines, which npm doesn't check on install.
  expect(!("engines" in manifest), "package.json has engines; a project on any active Node LTS must install it without a warning");
  const exports = Object.keys(manifest.exports ?? {});
  expect(exports.join() === EXPORTS.join(), `package.json exports ${exports.join(", ")}, expected ${EXPORTS.join(", ")}`);
}

function install(tarball: string, into: string): string {
  const consumer = join(into, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  const { stderr } = run("npm", ["install", "--offline", "--no-audit", "--no-fund", tarball], consumer);
  expect(!stderr.includes("EBADENGINE"), `npm warned about engines on install:\n${stderr}`);
  return consumer;
}

async function checkApi(consumer: string): Promise<void> {
  // Imported from inside the scratch project, so the names resolve through its node_modules.
  const entry = join(consumer, "api.js");
  writeFileSync(
    entry,
    [`export * as wireframe from "${NAME}";`, `export const styles = import.meta.resolve("${NAME}/styles.css");`].join("\n"),
  );
  try {
    const { wireframe, styles } = await import(pathToFileURL(entry).href);
    const names = Object.keys(wireframe).sort();
    expect(names.join() === API.join(), `${NAME} exports ${names.join(", ")}, expected ${API.join(", ")}`);
    const result = wireframe.parseWireframe("banner.warning\n  text Archived.");
    const summary = wireframe.summarizeWireframe(result);
    expect(summary === "Wireframe: warning banner “Archived.”", `the installed package summarizes a sample as ${summary}`);
    expect(readFileSync(new URL(styles), "utf8") === wireframe.getEmbedStyles(), `${NAME}/styles.css differs from getEmbedStyles()`);
  } catch (error) {
    problems.push(`the installed package doesn't load: ${error instanceof Error ? error.message : error}`);
  }
}

function checkTypes(consumer: string): void {
  const file = join(consumer, "consumer.ts");
  writeFileSync(file, CONSUMER);
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => consumer,
    getNewLine: () => "\n",
  };
  for (const [name, resolution] of Object.entries(RESOLUTIONS)) {
    const program = ts.createProgram([file], {
      ...resolution,
      target: ts.ScriptTarget.ES2022,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
      types: [],
      strict: true,
      noEmit: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.length === 0, `the types don't check with ${name} resolution:\n${ts.formatDiagnostics(diagnostics, host)}`);
  }
}

const scratch = mkdtempSync(join(tmpdir(), "wireframe-package-"));
let tarball = "";
try {
  tarball = process.argv[2] === undefined ? pack(scratch) : resolve(process.argv[2]);
  checkTarball(tarball);
  const consumer = install(tarball, scratch);
  await checkApi(consumer);
  checkTypes(consumer);
} catch (error) {
  problems.push(error instanceof Error ? error.message : String(error));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`The package check failed:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
  process.exit(1);
}
console.log(`${NAME}: the tarball, its package.json, the API, its types (${Object.keys(RESOLUTIONS).join(", ")}) and styles.css check out.`);
