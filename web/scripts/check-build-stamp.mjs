#!/usr/bin/env node
// Gate: a built web_dist MUST carry its build-identity stamp, or this exits 1.
//
// The stamp is emitted by the `hermes:build-stamp` plugin in vite.config.ts:
//   - <meta name="hermes-build-commit|time|dirty"> in index.html
//   - build-info.json next to it (served as GET /build-info.json)
//
// Wired as the last step of `npm run build`, so an unstamped build cannot
// complete the build chain. Every rejection names its own reason; every
// read error is a rejection (fail closed), never a pass.
//
// Usage:
//   node scripts/check-build-stamp.mjs [--require-head-match]
//   HERMES_WEB_DIST=<dir> node scripts/check-build-stamp.mjs   # check another dist
//
// Exit 0: stamp present and coherent (verdict JSON on stdout).
// Exit 1: named failure reason in verdict JSON on stdout.

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");
const distDir = process.env.HERMES_WEB_DIST
  ? path.resolve(process.env.HERMES_WEB_DIST)
  : path.resolve(repoRoot, "hermes_cli", "web_dist");
const requireHeadMatch = process.argv.includes("--require-head-match");

const SHA40 = /^[0-9a-f]{40}$/;

function fail(reason, extra = {}) {
  console.log(JSON.stringify({ ok: false, reason, distDir, ...extra }));
  process.exit(1);
}

function meta(html, name) {
  // Vite may emit attributes in either order; match both.
  const a = new RegExp(
    `<meta[^>]*name="${name}"[^>]*content="([^"]*)"[^>]*>`,
  ).exec(html);
  if (a) return a[1];
  const b = new RegExp(
    `<meta[^>]*content="([^"]*)"[^>]*name="${name}"[^>]*>`,
  ).exec(html);
  return b ? b[1] : null;
}

if (!existsSync(distDir)) fail("DIST_MISSING");

const indexPath = path.join(distDir, "index.html");
if (!existsSync(indexPath)) fail("INDEX_MISSING");

let html;
try {
  html = readFileSync(indexPath, "utf8");
} catch (err) {
  fail("INDEX_UNREADABLE", { error: String(err) });
}

const metaCommit = meta(html, "hermes-build-commit");
const metaTime = meta(html, "hermes-build-time");
const metaDirty = meta(html, "hermes-build-dirty");
if (metaCommit === null) fail("META_COMMIT_MISSING");
if (metaTime === null) fail("META_TIME_MISSING");
if (metaDirty === null) fail("META_DIRTY_MISSING");
if (!SHA40.test(metaCommit)) fail("META_COMMIT_NOT_40HEX", { metaCommit });

const infoPath = path.join(distDir, "build-info.json");
if (!existsSync(infoPath)) fail("BUILD_INFO_MISSING");

let info;
try {
  info = JSON.parse(readFileSync(infoPath, "utf8"));
} catch (err) {
  fail("BUILD_INFO_UNPARSEABLE", { error: String(err) });
}

if (typeof info.commit !== "string" || !SHA40.test(info.commit))
  fail("BUILD_INFO_COMMIT_NOT_40HEX", { commit: info.commit ?? null });
if (info.commit !== metaCommit)
  fail("COMMIT_MISMATCH", { metaCommit, jsonCommit: info.commit });
if (typeof info.buildTime !== "string" || Number.isNaN(Date.parse(info.buildTime)))
  fail("TIME_UNPARSEABLE", { buildTime: info.buildTime ?? null });
if (info.buildTime !== metaTime)
  fail("TIME_MISMATCH", { metaTime, jsonTime: info.buildTime });
if (typeof info.dirty !== "boolean" || String(info.dirty) !== metaDirty)
  fail("DIRTY_MISMATCH", { metaDirty, jsonDirty: info.dirty ?? null });

// Informational unless --require-head-match: a checker run long after the
// build legitimately sees a moved HEAD; only the build chain itself may
// demand equality, and even there a concurrent commit landing mid-build is
// possible in this multi-writer checkout, so the default stays advisory.
let headCommit = null;
let headMatches = null;
try {
  headCommit = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  headMatches = headCommit === info.commit;
} catch {
  // Not a git checkout (e.g. checking an installed runtime dist) — advisory
  // comparison unavailable; stamp coherence above already decided the gate.
}
if (requireHeadMatch && headMatches !== true)
  fail("HEAD_MISMATCH", { headCommit, stampCommit: info.commit });

console.log(
  JSON.stringify({
    ok: true,
    distDir,
    commit: info.commit,
    dirty: info.dirty,
    buildTime: info.buildTime,
    headCommit,
    headMatches,
  }),
);
