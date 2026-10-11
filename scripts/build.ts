import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

// Builds the package into dist: ES modules and type declarations compiled from
// src by tsconfig.build.json, and styles.css, written from getEmbedStyles() so
// the stylesheet has one source.

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

const { writeIcons } = await import(new URL("generate-icons.ts", import.meta.url).href);
writeIcons();
rmSync(dist, { recursive: true, force: true });
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
const { status } = spawnSync(process.execPath, [tsc, "--project", "tsconfig.build.json"], { cwd: root, stdio: "inherit" });
if (status !== 0) process.exit(status ?? 1);

const url = new URL("index.js", dist).href;
const { getEmbedStyles } = await import(url);
writeFileSync(new URL("styles.css", dist), getEmbedStyles());
