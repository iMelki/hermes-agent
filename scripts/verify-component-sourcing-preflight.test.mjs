import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { coversFile, runPreflight, COMPONENTS_DIR_REL } from './verify-component-sourcing-preflight.mjs';

// Fixture record carrying all 7 required fields with non-placeholder values, so the
// only variable under test is the `Covers:` line.
const VALID_RECORD = `# Sourcing record fixture

- Target app/surface and component job: hermes web fixture surface
- Target-app component checked: yes, inspected the sibling components first
- Component marketplace primitive checked: yes, checked the local marketplace ui set
- External pools checked or deliberately skipped: deliberately skipped, fixture scope
- Chosen source lane and why: target-app composition, matches house conventions
- License/access/dependency result: MIT, no new dependencies
- Proof expected before closeout: assertions in this suite
- Covers: ${COMPONENTS_DIR_REL}/**/*.tsx
`;

const PLAIN_COVERS_LINE = `- Covers: ${COMPONENTS_DIR_REL}/**/*.tsx`;

function makeFixture({ components = [], record } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'hermes-preflight-'));
  for (const file of components) {
    const abs = path.join(root, file);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, 'export {};\n');
  }
  if (record !== undefined) {
    mkdirSync(path.join(root, 'docs', 'preflight', 'records'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'preflight', 'records', '2026-09-01-fixture.md'), record);
  }
  return root;
}

test('coversFile: exact paths and globs stay strict about segments and extensions', () => {
  assert.equal(coversFile(`${COMPONENTS_DIR_REL}/Foo.tsx`, `${COMPONENTS_DIR_REL}/Foo.tsx`), true);
  assert.equal(coversFile(`${COMPONENTS_DIR_REL}/Bar.tsx`, `${COMPONENTS_DIR_REL}/Foo.tsx`), false);
  assert.equal(coversFile(`${COMPONENTS_DIR_REL}/**/*.tsx`, `${COMPONENTS_DIR_REL}/ui/Foo.tsx`), true);
  assert.equal(coversFile(`${COMPONENTS_DIR_REL}/*.tsx`, `${COMPONENTS_DIR_REL}/ui/Foo.tsx`), false);
});

// Control for the pair below: an unadorned cover must keep working, so a green
// backtick test can never be green because the parser started covering everything.
test('runPreflight: a plain (unwrapped) cover entry covers its component', () => {
  const root = makeFixture({
    components: [`${COMPONENTS_DIR_REL}/Foo.tsx`],
    record: VALID_RECORD.replace(PLAIN_COVERS_LINE, `- Covers: ${COMPONENTS_DIR_REL}/Foo.tsx`),
  });
  try {
    assert.deepEqual(runPreflight(root).failures, [], 'a plain cover must match its component');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Authors backtick-wrap paths in markdown (`path`); a backtick is never part of a
// component path, so before the strip a backticked cover could never match and a
// genuinely recorded component read as unrecorded (memsys#601 fleet fix).
const BACKTICKED_COVERS_RECORD = VALID_RECORD.replace(
  PLAIN_COVERS_LINE,
  `- Covers: \`${COMPONENTS_DIR_REL}/Foo.tsx\``,
);

test('runPreflight: a backtick-wrapped cover entry still covers its component', () => {
  const root = makeFixture({
    components: [`${COMPONENTS_DIR_REL}/Foo.tsx`],
    record: BACKTICKED_COVERS_RECORD,
  });
  try {
    assert.deepEqual(runPreflight(root).failures, [], 'a backticked cover must still match its component');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Matched pair for the backtick strip: stripping must not turn a NON-matching cover
// into a match. A backticked cover naming a different file still fails the gate --
// without this control, "backticks now match" could just be "everything now matches".
const BACKTICKED_WRONG_COVERS_RECORD = VALID_RECORD.replace(
  PLAIN_COVERS_LINE,
  `- Covers: \`${COMPONENTS_DIR_REL}/Other.tsx\``,
);

test('runPreflight: a backticked cover naming a different file does not cover', () => {
  const root = makeFixture({
    components: [`${COMPONENTS_DIR_REL}/Foo.tsx`],
    record: BACKTICKED_WRONG_COVERS_RECORD,
  });
  try {
    const { failures } = runPreflight(root);
    assert.equal(failures.length, 1, 'a non-matching backticked cover must not cover');
    assert.match(failures[0], /Foo\.tsx: new component with no sourcing-preflight record/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
