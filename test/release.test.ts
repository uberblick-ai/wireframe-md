// @vitest-environment node
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const sha = "a".repeat(40);
const other = "b".repeat(40);
const repo = "uberblick-ai/wireframe-md";
const notes = "\n\nNew release.  \n\n### Details\n\n- Keep `spacing`.\n\n";
const changelog = `# Changelog\n\n## Unreleased\n\nFuture.\n\n## 0.4.0 — 2026-10-15${notes}## 0.3.0\n\nOlder.\n`;
const directories: string[] = [];

// Every subprocess the release CLI can launch is replaced by this executable.
// Unknown commands fail closed; no real git, gh or npm can be reached.
const fake = String.raw`#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync('scenario.json', 'utf8'));
const sha = '${sha}';
const call = {tool, args};
if (args.includes('--notes-file')) call.notes = fs.readFileSync(args[args.indexOf('--notes-file') + 1], 'utf8');
if (args.includes('--input')) call.input = JSON.parse(fs.readFileSync(0, 'utf8'));
fs.appendFileSync('calls.jsonl', JSON.stringify(call) + '\n');
const output = (value, code = 0) => { if (value !== undefined) process.stdout.write(typeof value === 'string' ? value : JSON.stringify(value)); process.exit(code); };
const key = tool + ' ' + args.join(' ');
if (config.fail && key.includes(config.fail)) { process.stderr.write('simulated failure'); process.exit(7); }
if (tool === 'git') {
  if (args[0] === 'remote') output(config.origin ?? 'https://github.com/${repo}.git');
  if (args[0] === 'fetch') output('');
  if (args[0] === 'rev-parse') output(args[1] === 'HEAD' ? sha : config.main ?? sha);
  if (args[0] === 'status') output(config.dirty ?? '');
  if (args[0] === 'show-ref') output('', config.localTag ? 0 : 1);
  if (args[0] === 'ls-remote') output('', config.remoteTag ? 0 : 2);
  if (args[0] === 'tag' || args[0] === 'push') output('');
}
if (tool === 'npm' && args[0] === 'view') {
  if (config.npmExists) output('"0.4.0"');
  output(config.npmResponse ?? {error:{code:config.npmError ?? 'E404'}}, 1);
}
if (tool === 'gh') {
  if (args[0] === 'api') {
    const endpoint = args.find(arg => arg.startsWith('repos/'));
    if (endpoint.includes('ci.yml/runs')) output({workflow_runs:config.ci ?? [{id:9, name:'CI', head_sha:sha, status:'completed', conclusion:'success', html_url:'https://github.com/${repo}/actions/runs/9'}]});
    if (endpoint.endsWith('/dispatches')) output(config.dispatch ?? {workflow_run_id:42, html_url:'https://github.com/${repo}/actions/runs/42'});
    if (endpoint.endsWith('/runs/42')) {
      const watched = fs.existsSync('watched');
      output({id:42, head_sha:config.releaseSha ?? sha, head_branch:config.releaseBranch ?? 'main', event:'workflow_dispatch', path:'.github/workflows/release.yml', status: watched ? 'completed' : 'queued', conclusion:watched ? config.conclusion ?? 'success' : null, ...(watched ? config.finishedRun : config.initialRun)});
    }
  }
  if (args[0] === 'run' && args[1] === 'watch' && args[2] === '42') {
    if (config.wait) { fs.writeFileSync('waiting', ''); setInterval(() => {}, 1000); return; }
    fs.writeFileSync('watched', ''); output('');
  }
  if (args[0] === 'release' && args[1] === 'create') output('https://github.com/${repo}/releases/tag/v0.4.0');
}
process.stderr.write('unrecognized fake command: ' + key);
process.exit(99);
`;

function fixture(scenario: Record<string, unknown> = {}, source = changelog) {
  const directory = mkdtempSync(join(tmpdir(), "wireframe-release-test-"));
  directories.push(directory);
  mkdirSync(join(directory, "scripts"));
  mkdirSync(join(directory, "bin"));
  writeFileSync(join(directory, "bin/package.json"), '{"type":"commonjs"}');
  copyFileSync(fileURLToPath(new URL("../scripts/release.ts", import.meta.url)), join(directory, "scripts/release.ts"));
  writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", name: "@uberblick/wireframe", version: "0.4.0" }));
  writeFileSync(join(directory, "CHANGELOG.md"), source);
  writeFileSync(join(directory, "scenario.json"), JSON.stringify(scenario));
  writeFileSync(join(directory, "calls.jsonl"), "");
  for (const tool of ["git", "gh", "npm"]) {
    // CommonJS executable with no extension, outside the fixture's module type.
    writeFileSync(join(directory, "bin", tool), fake);
    chmodSync(join(directory, "bin", tool), 0o755);
  }
  const env = { ...process.env, PATH: join(directory, "bin"), UB_AGENTS_RUN: "", UB_AGENTS_RUN_CONFIG: "", TMPDIR: directory };
  const calls = () => readFileSync(join(directory, "calls.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { tool: string; args: string[]; notes?: string; input?: object });
  const run = (args = ["0.4.0", "--check"], overrides: NodeJS.ProcessEnv = {}) => {
    const result = spawnSync(process.execPath, [join(directory, "scripts/release.ts"), ...args], { cwd: directory, env: { ...env, ...overrides }, encoding: "utf8", timeout: 10000 });
    return { ...result, text: result.stdout + result.stderr };
  };
  return { directory, env, calls, run };
}

afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("release checks with fake executables", () => {
  it("prints the checked SHA and verbatim notes, with no publication", () => {
    const test = fixture();
    const result = test.run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(sha);
    expect(result.stdout.endsWith(notes)).toBe(true);
    expect(result.stdout).not.toContain("Older.");
    expect(test.calls().some((call) => call.args.includes("POST") || call.args[0] === "tag" || call.args[0] === "push" || call.args[1] === "create")).toBe(false);
    expect(test.calls().find((call) => call.args[0] === "fetch")?.args).toContain("+refs/heads/main:refs/remotes/origin/main");
  });

  it.each(["0.4", "v0.4.0", "01.4.0", "0.4.0-beta", "0.4.0\n", "1.2.3;echo hi"])("refuses invalid version %j before invoking tools", (version) => {
    const test = fixture();
    expect(test.run([version]).text).toContain("version check");
    expect(test.calls()).toEqual([]);
  });

  it.each(["UB_AGENTS_RUN", "UB_AGENTS_RUN_CONFIG"])("blocks a loop run via %s", (guard) => {
    const test = fixture();
    const result = test.run(undefined, { [guard]: "run-id" });
    expect(result.status).not.toBe(0);
    expect(result.text).toContain("maintainer check");
    expect(test.calls()).toEqual([]);
  });

  it.each([
    [{ origin: "https://github.com/other/repo" }, "origin check"],
    [{ fail: "git fetch" }, "fetch origin check"],
    [{ main: other }, "origin/main check"],
    [{ dirty: "?? file" }, "clean checkout check"],
    [{ localTag: true }, "local tag check"],
    [{ remoteTag: true }, "origin tag check"],
    [{ fail: "git ls-remote" }, "origin tag check"],
    [{ npmExists: true }, "npm version check"],
    [{ npmError: "E401" }, "npm version check"],
    [{ npmError: "EAI_AGAIN" }, "npm version check"],
    [{ npmResponse: "not JSON" }, "npm version check"],
    [{ ci: [] }, "CI workflow check"],
    [{ ci: [{ name: "CI", head_sha: other, status: "completed", conclusion: "success" }] }, "CI workflow check"],
  ] as const)("names a failing check for %j in both modes", (scenario, label) => {
    for (const args of [["0.4.0", "--check"], ["0.4.0"]]) {
      const test = fixture(scenario);
      const result = test.run(args);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`failed during ${label}`);
      expect(test.calls().some((call) => call.args.includes("POST"))).toBe(false);
    }
  });

  it("requires package name and version to match", () => {
    const test = fixture();
    writeFileSync(join(test.directory, "package.json"), '{"type":"module","name":"@uberblick/wireframe","version":"0.3.0"}');
    expect(test.run().text).toContain("package.json version check");
  });

  it.each(["queued", "in_progress", "waiting"])("refuses the newest %s CI run even when an older one succeeded", (status) => {
    const test = fixture({ ci: [
      { name: "CI", head_sha: sha, status, html_url: "newest-run" },
      { name: "CI", head_sha: sha, status: "completed", conclusion: "success" },
    ] });
    expect(test.run().text).toContain(`CI is ${status}; wait for it: newest-run`);
  });

  it.each(["failure", "cancelled", "skipped"])("refuses a newest CI conclusion of %s", (conclusion) => {
    const test = fixture({ ci: [{ name: "CI", head_sha: sha, status: "completed", conclusion }] });
    expect(test.run().text).toContain(`CI concluded ${conclusion}`);
  });

  it.each([
    changelog.replace("0.4.0 — 2026-10-15", "0.4.0"),
    changelog.replace("2026-10-15", "2026-02-29"),
    changelog.replace("2026-10-15", "0000-01-01"),
    changelog.replace("2026-10-15", "2026-13-01"),
    changelog.replace(notes, "\n\n"),
    `${changelog}\n## 0.4.0 — 2026-10-16\nDuplicate.\n`,
    `${changelog}\n## 0.4.0\nUndated duplicate.\n`,
  ])("rejects absent, invalid, empty or duplicate dated sections", (source) => {
    const result = fixture({}, source).run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("CHANGELOG check");
  });

  it("preserves CRLF and an EOF section without a final newline", () => {
    const source = "# Changelog\r\n\r\n## 0.4.0 — 2024-02-29\r\n\r\nLeap day.  \r\nLast line";
    const result = fixture({}, source).run();
    expect(result.status).toBe(0);
    expect(result.stdout.endsWith("\r\n\r\nLeap day.  \r\nLast line")).toBe(true);
  });
});

describe("publication with fake executables", () => {
  it("watches the dispatched run, checks its commit, then tags and releases with the exact notes", () => {
    const test = fixture();
    const result = test.run(["0.4.0"]);
    expect(result.status).toBe(0);
    const calls = test.calls();
    const dispatch = calls.find((call) => call.args.includes("POST"));
    expect(dispatch?.input).toEqual({ ref: "main", inputs: { version: "0.4.0" } });
    expect(calls.find((call) => call.args[1] === "watch")?.args).toEqual(["run", "watch", "42", "--repo", repo, "--exit-status"]);
    expect(calls.filter((call) => call.args.some((arg) => arg.includes("/runs/42")))).toHaveLength(2);
    expect(calls.find((call) => call.args[0] === "tag")?.args).toEqual(["tag", "-a", "v0.4.0", sha, "-m", "@uberblick/wireframe 0.4.0"]);
    expect(calls.find((call) => call.args[0] === "push")?.args).toEqual(["push", "origin", "refs/tags/v0.4.0:refs/tags/v0.4.0"]);
    const release = calls.find((call) => call.args[1] === "create");
    expect(release?.notes).toBe(notes);
    expect(release?.args).toEqual(["release", "create", "v0.4.0", "--repo", repo, "--verify-tag", "--title", "@uberblick/wireframe 0.4.0", "--notes-file", expect.any(String)]);
    expect(calls.indexOf(calls.find((call) => call.args[1] === "watch")!)).toBeLessThan(calls.indexOf(calls.find((call) => call.args[0] === "tag")!));
    expect(result.stdout).toContain(`/actions/runs/42`);
    expect(result.stdout).toContain(`/tree/v0.4.0 (${sha})`);
    expect(result.stdout).toContain(`/releases/tag/v0.4.0`);
  });

  it.each([
    { releaseSha: other },
    { releaseBranch: "other" },
    { initialRun: { id: 41 } },
    { finishedRun: { head_sha: other } },
    { conclusion: "failure" },
    { finishedRun: { status: "in_progress", conclusion: null } },
  ])("refuses to tag for a mismatched or unsuccessful dispatched run: %j", (scenario) => {
    const test = fixture(scenario);
    const result = test.run(["0.4.0"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("failed during release workflow succeeded");
    expect(result.stderr).toContain("Workflow:");
    expect(test.calls().some((call) => call.args[0] === "tag")).toBe(false);
  });

  it("does not fall back to listing runs if dispatch has no ID", () => {
    const test = fixture({ dispatch: {} });
    expect(test.run(["0.4.0"]).text).toContain("dispatch returned no workflow run ID");
    expect(test.calls().some((call) => call.args[1] === "watch")).toBe(false);
  });

  it.each([
    ["/dispatches", "release workflow dispatched", "Finished: none", "Remaining: release workflow dispatched"],
    ["gh run watch", "release workflow succeeded", "Finished: release workflow dispatched", "Remaining: release workflow succeeded"],
    ["git tag", "annotated tag created", "release workflow succeeded", "Remaining: annotated tag created"],
    ["git push", "tag pushed", "annotated tag created", "Remaining: tag pushed"],
    ["gh release create", "GitHub release created", "tag pushed", "Remaining: GitHub release created"],
  ])("reports progress without retrying %s", (fail, step, finished, remaining) => {
    const test = fixture({ fail });
    const result = test.run(["0.4.0"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`failed during ${step}`);
    expect(result.stderr).toContain(finished);
    expect(result.stderr).toContain(remaining);
    expect(result.stderr).toContain("Inspect remote state");
    expect(test.calls().filter((call) => `${call.tool} ${call.args.join(" ")}`.includes(fail))).toHaveLength(1);
    if (fail === "gh release create") expect(result.stderr).toContain("Tag: https://github.com/");
    expect(test.calls().some((call) => call.args.includes("--force") || call.args.includes("-d"))).toBe(false);
  });

  it("reports interruption while waiting, including the workflow link, and stops before tagging", async () => {
    const test = fixture({ wait: true });
    const child = spawn(process.execPath, [join(test.directory, "scripts/release.ts"), "0.4.0"], { cwd: test.directory, env: test.env });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    const closed = new Promise<number | null>((resolve) => child.on("close", resolve));
    try {
      await expect.poll(() => test.calls().some((call) => call.args[1] === "watch"), { timeout: 5000 }).toBe(true);
      child.kill("SIGTERM");
      expect(await closed).toBe(143);
      expect(output).toContain("failed during release workflow succeeded");
      expect(output).toContain("Finished: release workflow dispatched");
      expect(output).toContain("Workflow: https://github.com/uberblick-ai/wireframe-md/actions/runs/42");
      expect(test.calls().some((call) => call.args[0] === "tag")).toBe(false);
    } finally {
      child.kill("SIGTERM");
      await closed;
    }
  });
});
