import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createEphemeralDir, ephemeralChildEnv, ephemeralRoot } from './ephemeral-scratch.mjs';

const MAX_GATE_BYTES = 128 * 1024;

function requireUnlinkedDirectory(directory) {
  let cursor = path.resolve(directory);
  for (;;) {
    const stat = lstatSync(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`proof fixture refuses linked/non-directory ancestor: ${cursor}`);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const normalized = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalized(realpathSync(directory)) !== normalized(path.resolve(directory))) {
    throw new Error('proof fixture parent does not resolve to its declared directory');
  }
}

export function createProofFixture(purpose, parent = ephemeralRoot()) {
  requireUnlinkedDirectory(parent);
  if (process.platform === 'win32' && !/^c:\\/i.test(path.resolve(parent))) {
    throw new Error('Windows gate-proof writes are restricted to the C: fixture lane');
  }
  const root = createEphemeralDir({ owner: 'hermes', purpose, root: parent });
  writeFixture(root, '.proof-owner.json', JSON.stringify({
    version: 1, owner: 'hermes', purpose, retained: true,
    createdAt: new Date().toISOString(), cleanup: 'separately approved recoverable cleanup only',
  }) + '\n');
  return root;
}

export function writeFixture(root, relative, contents) {
  requireUnlinkedDirectory(root);
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) {
    throw new Error('proof fixture write escapes its exclusively owned root');
  }
  mkdirSync(path.dirname(target), { recursive: true });
  requireUnlinkedDirectory(path.dirname(target));
  writeFileSync(target, contents, { flag: 'wx' });
  return target;
}

export function copyGate(root, sourceRoot, relative) {
  const source = path.resolve(sourceRoot, relative);
  if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink()) {
    throw new Error('proof gate source must be an ordinary file');
  }
  const bytes = readFileSync(source);
  if (bytes.length > MAX_GATE_BYTES) throw new Error('proof gate exceeds the bounded copy budget');
  const target = writeFixture(root, relative, bytes);
  return { target, sourceSha256: createHash('sha256').update(bytes).digest('hex') };
}

export function runFixtureGate(script, root) {
  const temp = path.join(root, '.child-temp');
  const env = { ...ephemeralChildEnv(temp), LANG: 'C.UTF-8', TZ: 'UTC' };
  for (const name of ['SystemRoot', 'WINDIR']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  // The exact, copied entrypoints are read-only and dependency-free. No shell,
  // install, build, service, taskkill, or repository-runner execution occurs.
  const result = spawnSync(process.execPath, [script], {
    cwd: root, env, shell: false, windowsHide: true, encoding: 'utf8',
    maxBuffer: 64 * 1024, timeout: 10000,
  });
  if (result.error || result.signal || !Number.isInteger(result.status)) {
    throw new Error(`proof child did not produce a verdict: ${result.error?.message ?? result.signal}`);
  }
  return result;
}

export function checkVerdict(result, status, expected, phase) {
  if (result.status !== status || !expected.test((result.stdout ?? '') + (result.stderr ?? ''))) {
    throw new Error(`${phase} proof failed: status=${result.status}, output=` +
      JSON.stringify((result.stdout ?? '') + (result.stderr ?? '')));
  }
}

export function retainedFailure(error, root) {
  const failure = error instanceof Error ? error : new Error(String(error));
  failure.fixtureRoot = root;
  return failure;
}
