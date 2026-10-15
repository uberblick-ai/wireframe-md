import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Maintainer tooling only; outside the installed package. All publication goes
// through release.yml and its npm environment approval.
const repository = "uberblick-ai/wireframe-md";
const packageName = "@uberblick/wireframe";
const root = fileURLToPath(new URL("../", import.meta.url));
const steps = ["release workflow dispatched", "release workflow succeeded", "annotated tag created", "tag pushed", "GitHub release created"] as const;
const abort = new AbortController();
let interrupted = 0;
for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
  process.on(signal, () => {
    interrupted = code;
    process.exitCode = code;
    abort.abort(new Error(`interrupted by ${signal}`));
  });
}

async function command(args: string[], allowed = [0], input?: string) {
  abort.signal.throwIfAborted();
  const [executable, ...rest] = args;
  if (!executable) throw new Error("missing executable");
  return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, rest, { cwd: root, signal: abort.signal, stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (data) => { stdout += data; });
    child.stderr.setEncoding("utf8").on("data", (data) => { stderr += data; });
    // Wait for close, including on interruption, so no child is left running.
    let error: Error | undefined;
    child.on("error", (cause) => { error = cause; });
    child.stdin.on("error", (cause) => { error = cause; });
    child.on("close", (code, signal) => {
      if (error || code === null || !allowed.includes(code)) {
        reject(new Error(`${args.join(" ")} failed (${signal ?? code ?? "spawn"}): ${error?.message ?? (stderr || stdout).trim()}`));
      } else resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function git(...args: string[]) {
  return (await command(["git", ...args])).stdout.trim();
}

async function api(path: string, body?: object) {
  const args = ["gh", "api", "--hostname", "github.com", "-H", "X-GitHub-Api-Version: 2026-03-10", `repos/${repository}/${path}`];
  if (body) args.push("--method", "POST", "--input", "-");
  return JSON.parse((await command(args, [0], body ? JSON.stringify(body) : undefined)).stdout);
}

function notesFrom(changelog: string, version: string): string {
  // Slice the original string rather than splitting/rejoining lines: whitespace
  // and nested headings in the release notes must survive byte for byte.
  const headings = [...changelog.matchAll(/^## [^\r\n]+/gm)];
  const candidates = headings.filter((heading) => heading[0] === `## ${version}` || heading[0].startsWith(`## ${version} `));
  if (candidates.length !== 1) throw new Error(`expected exactly one ## ${version} — YYYY-MM-DD section`);
  const heading = candidates[0];
  const date = heading?.[0].match(/ — (\d{4}-\d{2}-\d{2})$/)?.[1];
  if (!heading || !date || date.startsWith("0000-") || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error(`expected ## ${version} — YYYY-MM-DD with a valid date`);
  }
  const next = headings[headings.indexOf(heading) + 1];
  const notes = changelog.slice(heading.index + heading[0].length, next?.index ?? changelog.length);
  if (!notes.trim()) throw new Error("release notes are empty");
  return notes;
}

class Release {
  step = "arguments check";
  completed: string[] = [];
  links: string[] = [];
  sha = "";

  async check(version: string) {
    this.step = "version check";
    if (version.trim() !== version || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error("use X.Y.Z");
    this.step = "maintainer check";
    if (process.env.UB_AGENTS_RUN || process.env.UB_AGENTS_RUN_CONFIG) throw new Error("loop roles cannot run releases, including --check");
    this.step = "origin check";
    const origin = (await git("remote", "get-url", "origin")).replace(/\.git$/, "");
    if (![ `https://github.com/${repository}`, `git@github.com:${repository}`, `ssh://git@github.com/${repository}` ].includes(origin)) {
      throw new Error(`expected origin ${repository}`);
    }
    this.step = "fetch origin check";
    await git("fetch", "--quiet", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main");
    this.step = "origin/main check";
    this.sha = await git("rev-parse", "HEAD");
    if (this.sha !== await git("rev-parse", "refs/remotes/origin/main")) throw new Error("HEAD must equal current origin/main");
    this.step = "clean checkout check";
    if (await git("status", "--porcelain", "--untracked-files=all")) throw new Error("commit or remove uncommitted changes first");
    this.step = "package.json version check";
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    if (pkg.name !== packageName || pkg.version !== version) throw new Error(`expected ${packageName} version ${version}`);
    this.step = "CHANGELOG check";
    const notes = notesFrom(await readFile(join(root, "CHANGELOG.md"), "utf8"), version);
    this.step = "local tag check";
    const tag = `refs/tags/v${version}`;
    if ((await command(["git", "show-ref", "--verify", "--quiet", tag], [0, 1])).code === 0) throw new Error(`${tag} already exists`);
    this.step = "origin tag check";
    if ((await command(["git", "ls-remote", "--exit-code", "--tags", "origin", tag], [0, 2])).code === 0) throw new Error(`${tag} already exists`);
    this.step = "npm version check";
    const npm = await command(["npm", "view", `${packageName}@${version}`, "version", "--json", "--registry=https://registry.npmjs.org/"], [0, 1]);
    if (npm.code === 0) throw new Error(`${packageName}@${version} already exists on npm`);
    if (JSON.parse(npm.stdout).error?.code !== "E404") throw new Error(`cannot establish version absence: ${npm.stderr || npm.stdout}`);
    this.step = "CI workflow check";
    const result = await api(`actions/workflows/ci.yml/runs?head_sha=${this.sha}&per_page=1`);
    // The API lists newest first; never fall back to an older successful run.
    const latest = result.workflow_runs?.[0];
    if (latest?.name !== "CI" || latest.head_sha !== this.sha) throw new Error(`no CI run for ${this.sha}`);
    if (latest.status !== "completed") throw new Error(`CI is ${latest.status}; wait for it: ${latest.html_url}`);
    if (latest.conclusion !== "success") throw new Error(`CI concluded ${latest.conclusion}: ${latest.html_url}`);
    console.log(`Release checks passed: ${this.sha}\nRelease notes (verbatim, without heading):`);
    process.stdout.write(notes);
    return notes;
  }

  done() {
    this.completed.push(this.step);
    console.log(`\nrelease: ${this.step}`);
  }

  async publish(version: string, notes: string) {
    this.step = steps[0];
    // This API version returns the dispatched run directly. Never discover a
    // release by listing runs: a concurrent dispatch could select another run.
    const dispatch = await api("actions/workflows/release.yml/dispatches", { ref: "main", inputs: { version } });
    const id = dispatch.workflow_run_id;
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("dispatch returned no workflow run ID; inspect Actions manually");
    const runUrl = `https://github.com/${repository}/actions/runs/${id}`;
    this.links.push(`Workflow: ${runUrl}`);
    this.done();
    console.log(`${runUrl}\nMaintainer: approve the npm deployment in this run. Waiting for this run only.`);
    this.step = steps[1];
    const run = await api(`actions/runs/${id}`);
    this.verifyRun(run, id);
    await command(["gh", "run", "watch", String(id), "--repo", repository, "--exit-status"]);
    const finished = await api(`actions/runs/${id}`);
    this.verifyRun(finished, id);
    if (finished.status !== "completed" || finished.conclusion !== "success") throw new Error(`release run is ${finished.conclusion ?? finished.status}`);
    this.done();

    const tag = `v${version}`;
    this.step = steps[2];
    await git("tag", "-a", tag, this.sha, "-m", `${packageName} ${version}`);
    this.done();
    this.step = steps[3];
    await git("push", "origin", `refs/tags/${tag}:refs/tags/${tag}`);
    this.links.push(`Tag: https://github.com/${repository}/tree/${tag} (${this.sha})`);
    this.done();
    this.step = steps[4];
    const directory = await mkdtemp(join(tmpdir(), "wireframe-release-"));
    try {
      const notesFile = join(directory, "release-notes.md");
      await writeFile(notesFile, notes);
      await command(["gh", "release", "create", tag, "--repo", repository, "--verify-tag", "--title", `${packageName} ${version}`, "--notes-file", notesFile]);
      this.links.push(`Release: https://github.com/${repository}/releases/tag/${tag}`);
      this.done();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    console.log(this.links.join("\n"));
  }

  verifyRun(run: { id: number; head_sha: string; head_branch: string; event: string; path: string }, id: number) {
    if (run.id !== id || run.head_sha !== this.sha || run.head_branch !== "main" || run.event !== "workflow_dispatch" || run.path !== ".github/workflows/release.yml") {
      throw new Error(`release run must be release.yml on main at checked commit ${this.sha}; observed ${run.head_sha}`);
    }
  }

  failure(error: unknown) {
    console.error(`release: failed during ${this.step}: ${error instanceof Error ? error.message : String(error)}\n` +
      `Checked commit: ${this.sha || "not yet checked"}\n` +
      `Finished: ${this.completed.join(", ") || "none"}\n` +
      `Remaining: ${steps.filter((step) => !this.completed.includes(step)).join(", ") || "none"}\n` +
      `${this.links.join("\n")}\n` +
      "A failed or interrupted publication command may have completed remotely. Inspect remote state and finish manually; never rerun publication or move, delete or re-create a pushed tag.");
  }
}

const release = new Release();
try {
  const args = process.argv.slice(2);
  const version = args[0];
  if (!version || args.length > 2 || (args[1] !== undefined && args[1] !== "--check")) throw new Error("usage: mise run release X.Y.Z [--check]");
  const notes = await release.check(version);
  if (args[1] !== "--check") await release.publish(version, notes);
  abort.signal.throwIfAborted();
} catch (error) {
  release.failure(error);
  process.exitCode = interrupted || 1;
}
