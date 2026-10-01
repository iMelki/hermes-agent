import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { test } from 'node:test';
import { proveRootInstall } from './assert-root-install-proof.mjs';
import { proveComponentSourcing } from './component-sourcing-preflight-proof.mjs';
import { createProofFixture, writeFixture } from './owned-proof-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publishedHead = 'ca0b4f9de6bc4411039190ac0edf767c8204bc21';
const proofNames = ['assert-root-install-proof.mjs', 'component-sourcing-preflight-proof.mjs'];
const gatePaths = ['apps/desktop/scripts/assert-root-install.mjs', 'scripts/verify-component-sourcing-preflight.mjs'];

function publishedProof(name) {
  const gitExecutable = process.env.HERMES_PROOF_GIT;
  assert.ok(gitExecutable && path.isAbsolute(gitExecutable), 'caller must supply absolute HERMES_PROOF_GIT');
  assert.ok(lstatSync(gitExecutable).isFile(), 'caller-resolved Git must be an existing executable file');
  const env = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  const result = spawnSync(gitExecutable, ['show', `${publishedHead}:tests/gate-evidence/${name}`], {
    cwd: repoRoot, env, shell: false, windowsHide: true, encoding: 'utf8',
    maxBuffer: 16 * 1024, timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function previousPreservation(name) {
  const root = path.resolve(path.parse(repoRoot).root, 'virtual-owner-do-not-materialize');
  const cache = path.join(root, 'node_modules/vite/.cache/owner-cache.bin');
  const tsx = path.join(root, 'web/src/components/_gate_evidence_uncovered.tsx');
  const files = new Map([[cache, 'owner-cache-bytes'], [tsx, 'owner-tsx-bytes']]);
  const before = new Map(files);
  const directories = new Set([path.join(root, 'node_modules'), path.join(root, 'node_modules/vite')]);
  let childCalls = 0;
  const context = {
    mkdirSync: (target) => directories.add(target),
    writeFileSync: (target, bytes) => files.set(target, String(bytes)),
    existsSync: (target) => files.has(target) || directories.has(target),
    rmSync: (target) => {
      for (const key of files.keys()) if (key === target || key.startsWith(target + path.sep)) files.delete(key);
    },
    unlinkSync: (target) => files.delete(target),
    spawnSync: () => {
      const negative = childCalls++ === 0;
      const output = name.startsWith('assert-root')
        ? (negative ? 'Run npm ci' : '')
        : (negative ? 'COMPONENT_SOURCING_PREFLIGHT=fail _gate_evidence_uncovered.tsx'
          : 'COMPONENT_SOURCING_PREFLIGHT=pass');
      return { status: negative ? 1 : 0, stdout: output, stderr: '' };
    },
    process: { execPath: 'virtual-node', exit: (code) => { throw new Error(`unexpected old exit ${code}`); } },
    console: { log() {}, error() {} }, fileURLToPath,
    dirname: path.dirname, join: path.join, resolve: path.resolve,
  };
  const source = publishedProof(name)
    .replace(/^import .* from .*\r?\n/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path.join(root, 'tests/gate-evidence', name)).href));
  vm.runInNewContext(source, context, { timeout: 1000 });
  assert.equal(childCalls, 2, 'actual old proof reached both verdict stages');
  const changed = [...before].filter(([key, bytes]) => files.get(key) !== bytes).map(([key]) => key);
  return { preserved: changed.length === 0, changed, actualSource: publishedHead, realFsMutations: 0 };
}

function snapshot(root) {
  const files = {};
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      assert.equal(lstatSync(target).isSymbolicLink(), false);
      if (entry.isDirectory()) walk(target);
      else files[path.relative(root, target)] = readFileSync(target).toString('base64');
    }
  }
  walk(root);
  return files;
}

function ownerFixture() {
  const root = createProofFixture('preservationowner');
  for (const relative of gatePaths) writeFixture(root, relative, readFileSync(path.join(repoRoot, relative)));
  writeFixture(root, 'node_modules/vite/.cache/owner-cache.bin', 'owner-cache-bytes');
  writeFixture(root, 'web/src/components/_gate_evidence_uncovered.tsx', 'owner-tsx-bytes');
  return root;
}

const previousOnly = process.argv.includes('--prove-previous');
for (const name of proofNames) {
  test(`${previousOnly ? 'old preservation obligation' : 'historical destructive counterexample'}: ${name}`, () => {
    const result = previousPreservation(name);
    assert.equal(result.preserved, previousOnly, JSON.stringify(result));
  });
}

if (!previousOnly) {
  test('canonical scratch bytes and invocation wiring reconcile', () => {
    const provenance = JSON.parse(readFileSync(new URL('./ephemeral-scratch.provenance.json', import.meta.url)));
    const digest = createHash('sha256').update(readFileSync(new URL('./ephemeral-scratch.mjs', import.meta.url))).digest('hex');
    assert.equal(digest, provenance.canonicalSha256);
    const scripts = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'))).scripts;
    assert.equal(scripts['test:gate-proof-preservation'], 'node tests/gate-evidence/gate-proof-preservation.test.mjs');
    const keys = ['HERMES_PROOF_GIT', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_CONFIG_COUNT'];
    const saved = new Map(keys.map((key) => [key, process.env[key]]));
    try {
      delete process.env.HERMES_PROOF_GIT;
      assert.throws(() => publishedProof(proofNames[0]), /caller must supply absolute/);
      process.env.HERMES_PROOF_GIT = 'git';
      assert.throws(() => publishedProof(proofNames[0]), /caller must supply absolute/);
      process.env.HERMES_PROOF_GIT = path.join(repoRoot, 'nonexistent-git-proof.exe');
      assert.throws(() => publishedProof(proofNames[0]), { code: 'ENOENT' });
      process.env.HERMES_PROOF_GIT = repoRoot;
      assert.throws(() => publishedProof(proofNames[0]), /existing executable file/);
      process.env.HERMES_PROOF_GIT = saved.get('HERMES_PROOF_GIT');
      process.env.GIT_DIR = path.join(repoRoot, 'nonexistent-git-context');
      process.env.GIT_WORK_TREE = path.join(repoRoot, 'nonexistent-work-tree');
      process.env.GIT_CONFIG_COUNT = 'invalid-config-count';
      assert.match(publishedProof(proofNames[0]), /^import /m);
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test('fixture writes refuse an occupied file and an escape without altering bytes', () => {
    const root = createProofFixture('exclusivewrite');
    writeFixture(root, 'occupied.txt', 'owner-bytes');
    assert.throws(() => writeFixture(root, 'occupied.txt', 'replacement'), { code: 'EEXIST' });
    assert.throws(() => writeFixture(root, '../escape.txt', 'replacement'), /escapes/);
    assert.equal(readFileSync(path.join(root, 'occupied.txt'), 'utf8'), 'owner-bytes');
    assert.throws(() => createProofFixture('occupiedparent', path.join(root, 'occupied.txt')), /non-directory/);
    const missing = path.join(root, 'missing-parent');
    assert.throws(() => createProofFixture('missingparent', missing), { code: 'ENOENT' });
    assert.throws(() => lstatSync(missing), { code: 'ENOENT' });
  });

  for (const [name, prove] of [['root-install', proveRootInstall], ['component-sourcing', proveComponentSourcing]]) {
    for (const outcome of ['success', 'negative-fail', 'restored-fail', 'throw', 'interruption']) {
      test(`${name}: retains partial cache and occupied TSX on ${outcome}`, () => {
        const owner = ownerFixture();
        const before = snapshot(owner);
        let calls = 0;
        const options = { sourceRoot: owner };
        if (outcome !== 'success') {
          options.runChild = () => {
            calls += 1;
            if (outcome === 'throw' || outcome === 'interruption') throw new Error(`synthetic ${outcome}`);
            if (outcome === 'negative-fail') return { status: 2, stdout: 'synthetic failure', stderr: '' };
            if (calls === 1) return { status: 1, stdout: name === 'root-install' ? 'npm ci'
              : 'COMPONENT_SOURCING_PREFLIGHT=fail _gate_evidence_uncovered.tsx', stderr: '' };
            return { status: 2, stdout: 'synthetic restored failure', stderr: '' };
          };
        }
        let retained;
        if (outcome === 'success') {
          const result = prove(options);
          assert.equal(result.negativeExit, 1);
          assert.equal(result.restoredExit, 0);
          retained = result.fixtureRoot;
          assert.equal(result.retained, true);
        } else {
          assert.throws(() => prove(options), (error) => {
            retained = error.fixtureRoot;
            return typeof retained === 'string' && /synthetic|proof failed/.test(error.message);
          });
        }
        assert.notEqual(retained, owner);
        assert.equal(JSON.parse(readFileSync(path.join(retained, '.proof-owner.json'))).retained, true);
        assert.deepEqual(snapshot(owner), before, 'owner paths and bytes must be identical');
      });
    }
  }
}
