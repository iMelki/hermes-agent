#!/usr/bin/env node
/**
 * Component sourcing preflight gate (fork-local governance; iMelki/hermes#45,
 * iMelki/agent-settings#586).
 *
 * Fork note: this file is additive fork-local governance. It does not exist upstream
 * (NousResearch/hermes-agent) and touches no upstream source, so it should survive
 * upstream merges without conflict. The logic is deliberately kept line-for-line
 * comparable to the fleet sibling
 * mission-control-kanban/scripts/verify-component-sourcing-preflight.mjs so a future
 * fleet fix can be applied mechanically. Everything repo-specific lives in the
 * CONFIG block below.
 *
 * Every component file under web/src/components must be either:
 *   1. Grandfathered in docs/preflight/component-baseline.json ({file, reason}), or
 *   2. Covered by a "Covers:" line (exact path or glob) in at least one record under
 *      docs/preflight/records/*.md that carries all 7 sourcing-record fields from
 *      agent-settings shared/prompts/frontend-component-sourcing.md with
 *      non-placeholder values.
 *
 * Ratchet-down: a baseline entry whose file no longer exists is also a failure —
 * remove the stale entry so the baseline only shrinks.
 *
 * Zero dependencies. Mirrors the field labels/aliases of
 * agent-settings shared/tools/Test-FrontendComponentSourcingPreflight.ps1.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- CONFIG (repo-specific; the rest of this file matches the fleet sibling) ------
// The fork's only React surface is the Vite web app, so the gate is scoped there.
// Other TSX-bearing trees (ui-tui, apps/*, website) are out of scope until they are
// added here deliberately — see docs/preflight/README.md "Scope".
const COMPONENTS_DIR_SEGMENTS = ['web', 'src', 'components'];
const COMPONENTS_DIR_REL = COMPONENTS_DIR_SEGMENTS.join('/');
// ---------------------------------------------------------------------------------

const REQUIRED_FIELD_ALIASES = [
  ['target app/surface and component job', 'target app/surface', 'target surface', 'surface'],
  ['target-app component checked', 'target app component checked', 'target-app checked', 'target app checked'],
  ['component marketplace primitive checked', 'component marketplace checked', 'local component marketplace checked'],
  ['external pools checked or deliberately skipped', 'external pools checked or skipped', 'external pools checked', 'external pools'],
  ['chosen source lane and why', 'chosen source lane', 'source lane'],
  ['license/access/dependency result', 'license access dependency result', 'license/access/pricing/dependency result', 'license'],
  ['proof expected before closeout', 'proof expected', 'verification expected', 'closeout proof'],
];

function normalizeLabel(value) {
  return value
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[^a-z0-9/ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMeaningful(value) {
  const trimmed = (value ?? '').trim();
  if (trimmed.length < 3) return false;
  return !/^(todo|tbd|unknown|n\/?a|none|\?+|-+)$/i.test(trimmed);
}

function listComponentFiles(dir, prefix = COMPONENTS_DIR_REL) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listComponentFiles(path.join(dir, entry.name), rel));
    else if (/\.(tsx|jsx)$/.test(entry.name)) files.push(rel);
  }
  return files;
}

function parseRecord(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const fieldValues = new Map();
  const covers = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.trim().match(/^(?:[-*]\s+|\d+\.\s+)?(.+?):\s*(.*)$/);
    if (!match) continue;
    const label = normalizeLabel(match[1]);
    if (label === 'covers') {
      for (const target of match[2].split(',')) {
        // Authors backtick-wrap paths in markdown (`path`); backticks are never part
        // of a component path, so strip them or the cover can never match (memsys#601).
        const cleaned = target.trim().replace(/`/g, '').trim();
        if (cleaned) covers.push(cleaned.replace(/\\/g, '/'));
      }
      continue;
    }
    for (let i = 0; i < REQUIRED_FIELD_ALIASES.length; i++) {
      if (REQUIRED_FIELD_ALIASES[i].some((alias) => normalizeLabel(alias) === label) && !fieldValues.has(i)) {
        fieldValues.set(i, match[2].trim());
      }
    }
  }
  const missing = REQUIRED_FIELD_ALIASES
    .map((aliases, i) => (isMeaningful(fieldValues.get(i)) ? null : aliases[0]))
    .filter(Boolean);
  return { name: path.basename(filePath), valid: missing.length === 0, missing, covers };
}

function coversFile(pattern, file) {
  if (pattern === file) return true;
  if (!/[*?]/.test(pattern)) return false;
  // Segment-aware glob: `**` matches zero or more whole directory levels, so
  // web/src/components/**/*.tsx covers both web/src/components/Foo.tsx and nested files.
  const segments = pattern.split('/');
  let regex = '^';
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const needsSlash = i > 0 && segments[i - 1] !== '**';
    if (segment === '**') {
      if (needsSlash) regex += '/';
      regex += i === segments.length - 1 ? '.*' : '(?:[^/]+/)*';
      continue;
    }
    if (needsSlash) regex += '/';
    regex += segment
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
  }
  return new RegExp(`${regex}$`).test(file);
}

function runPreflight(repoRoot = defaultRepoRoot) {
  const componentsDir = path.join(repoRoot, ...COMPONENTS_DIR_SEGMENTS);
  const baselinePath = path.join(repoRoot, 'docs', 'preflight', 'component-baseline.json');
  const recordsDir = path.join(repoRoot, 'docs', 'preflight', 'records');

  const components = listComponentFiles(componentsDir);
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : [];
  const records = existsSync(recordsDir)
    ? readdirSync(recordsDir).filter((name) => name.endsWith('.md')).sort()
        .map((name) => parseRecord(path.join(recordsDir, name)))
    : [];

  const failures = [];
  const baselineEntries = Array.isArray(baseline) ? baseline : [];
  if (!Array.isArray(baseline)) {
    failures.push('docs/preflight/component-baseline.json: expected a JSON array of {file, reason} entries.');
  }
  const baselineFiles = new Set();
  for (const [index, entry] of baselineEntries.entries()) {
    const file = String(entry?.file ?? '').replace(/\\/g, '/');
    const reason = typeof entry?.reason === 'string' ? entry.reason : '';
    if (!isMeaningful(reason)) {
      failures.push(`docs/preflight/component-baseline.json: entry ${index} (${file || '<missing file>'}) must include a non-placeholder reason.`);
    }
    if (!file) continue;
    baselineFiles.add(file);
    if (!components.includes(file)) {
      failures.push(`docs/preflight/component-baseline.json: baselined file ${file} no longer exists on disk. Remove its baseline entry (the baseline only ratchets down).`);
    }
  }

  for (const file of components) {
    if (baselineFiles.has(file)) continue;
    const validCover = records.some((record) => record.valid && record.covers.some((pattern) => coversFile(pattern, file)));
    if (validCover) continue;
    const invalidCover = records.find((record) => !record.valid && record.covers.some((pattern) => coversFile(pattern, file)));
    const hint = invalidCover
      ? ` (docs/preflight/records/${invalidCover.name} covers it but is missing/placeholder on: ${invalidCover.missing.join('; ')})`
      : '';
    failures.push(`${file}: new component with no sourcing-preflight record.${hint} Write docs/preflight/records/<date>-<slug>.md with the 7-field record from agent-settings shared/prompts/frontend-component-sourcing.md plus a Covers: line naming this file; validate with Test-FrontendComponentSourcingPreflight.ps1 -RequireKnownPoolMention. Reviewed exception: add {file, reason} to docs/preflight/component-baseline.json.`);
  }

  return {
    failures,
    summary: `COMPONENT_SOURCING_PREFLIGHT=pass (${components.length} components: ${baselineFiles.size} baselined, ${components.length - baselineFiles.size} record-covered; ${records.length} records)`,
  };
}

export { coversFile, isMeaningful, parseRecord, runPreflight, COMPONENTS_DIR_REL };

const invokedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  const { failures, summary } = runPreflight();
  if (failures.length > 0) {
    console.error('COMPONENT_SOURCING_PREFLIGHT=fail');
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log(summary);
}
