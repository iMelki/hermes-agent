// Regression: gate-evidence proofs must use the real gate CLI, keep the
// child exit status separate from the wrapper's, and never create or
// delete files in the live checkout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ENV_ROOT, ENV_SKIP_RESTORE, SOURCE_REPO_ROOT } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix))
}

function runProof(proof, envExtra = {}) {
  return spawnSync(process.execPath, [join(here, proof)], {
    cwd: SOURCE_REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...envExtra },
  })
}

function parseResult(stdout) {
  const m = /child_negative=(null|\d+) child_restored=(null|\d+) wrapper=(\d+)/.exec(stdout)
  assert.ok(m, `expected parseable proof result in stdout, got: ${stdout}`)
  const num = (v) => (v === 'null' ? null : Number(v))
  return { childNegative: num(m[1]), childRestored: num(m[2]), wrapper: Number(m[3]) }
}

const ROOT = 'assert-root-install-proof.mjs'
const COMP = 'component-sourcing-preflight-proof.mjs'
const DIST = 'assert-dist-built-proof.mjs'
const FOOTGUN = 'windows-footgun-proof.mjs'
const PLANT = 'web/src/components/_gate_evidence_uncovered.tsx'

test('root-install: partial node_modules/vite without package.json survives', () => {
  const root = tempDir('gate-proof-')
  try {
    mkdirSync(join(root, 'node_modules/vite'), { recursive: true })
    writeFileSync(join(root, 'node_modules/vite/cache.bin'), 'owner-bytes')
    const r = runProof(ROOT, { [ENV_ROOT]: root })
    assert.equal(r.status, 4)
    assert.equal(readFileSync(join(root, 'node_modules/vite/cache.bin'), 'utf8'), 'owner-bytes')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('root-install: sibling node_modules content survives and only proof files are removed', () => {
  const root = tempDir('gate-proof-')
  try {
    mkdirSync(join(root, 'node_modules/other'), { recursive: true })
    writeFileSync(join(root, 'node_modules/other/keep.txt'), 'owner-bytes')
    const r = runProof(ROOT, { [ENV_ROOT]: root })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 0)
    assert.equal(parsed.wrapper, 0)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 0)
    assert.notEqual(parsed.childNegative, parsed.wrapper)
    assert.equal(readFileSync(join(root, 'node_modules/other/keep.txt'), 'utf8'), 'owner-bytes')
    assert.equal(existsSync(join(root, 'node_modules/vite')), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('root-install: a node_modules the proof created is removed again', () => {
  const root = tempDir('gate-proof-')
  try {
    const r = runProof(ROOT, { [ENV_ROOT]: root })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 0)
    assert.equal(parsed.wrapper, 0)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 0)
    assert.equal(existsSync(join(root, 'node_modules')), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('root-install: wrapper and child exit statuses differ when the restored CLI fails', () => {
  const root = tempDir('gate-proof-')
  try {
    const r = runProof(ROOT, { [ENV_ROOT]: root, [ENV_SKIP_RESTORE]: '1' })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 3)
    assert.equal(parsed.wrapper, 3)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 1)
    assert.notEqual(parsed.childRestored, parsed.wrapper)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('component proof: pre-existing plant file is never overwritten or removed', () => {
  const root = tempDir('gate-proof-')
  try {
    mkdirSync(join(root, 'web/src/components'), { recursive: true })
    writeFileSync(join(root, PLANT), 'owner tsx')
    const r = runProof(COMP, { [ENV_ROOT]: root })
    assert.equal(r.status, 4)
    assert.equal(readFileSync(join(root, PLANT), 'utf8'), 'owner tsx')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('component proof: cleans only its own plant', () => {
  const root = tempDir('gate-proof-')
  try {
    const r = runProof(COMP, { [ENV_ROOT]: root })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 0)
    assert.equal(parsed.wrapper, 0)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 0)
    assert.notEqual(parsed.childNegative, parsed.wrapper)
    assert.equal(existsSync(join(root, PLANT)), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('component proof: wrapper and child exit statuses differ when the restored CLI fails', () => {
  const root = tempDir('gate-proof-')
  try {
    const r = runProof(COMP, { [ENV_ROOT]: root, [ENV_SKIP_RESTORE]: '1' })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 3)
    assert.equal(parsed.wrapper, 3)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 1)
    assert.notEqual(parsed.childRestored, parsed.wrapper)
    assert.equal(existsSync(join(root, PLANT)), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('dist-built proof: success path spawns the real CLI and reports distinct child and wrapper exits', () => {
  const tmp = tempDir('gate-proof-tmp-')
  try {
    const r = runProof(DIST, { TMPDIR: tmp, TMP: tmp, TEMP: tmp })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 0)
    assert.equal(parsed.wrapper, 0)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 0)
    assert.notEqual(parsed.childNegative, parsed.wrapper)
    assert.deepEqual(readdirSync(tmp), [])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('dist-built proof: failure path still removes its temp fixture, and child and wrapper exits differ', () => {
  const tmp = tempDir('gate-proof-tmp-')
  try {
    const r = runProof(DIST, { TMPDIR: tmp, TMP: tmp, TEMP: tmp, [ENV_SKIP_RESTORE]: '1' })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 3)
    assert.equal(parsed.wrapper, 3)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 1)
    assert.notEqual(parsed.childRestored, parsed.wrapper)
    assert.deepEqual(readdirSync(tmp), [])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('footgun proof: a missing restored fixture fails instead of passing on 0 files scanned', () => {
  const root = tempDir('gate-proof-')
  try {
    const r = runProof(FOOTGUN, { [ENV_ROOT]: root, [ENV_SKIP_RESTORE]: '1' })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 3)
    assert.equal(parsed.wrapper, 3)
    assert.equal(parsed.childNegative, 1)
    // The real checker exits 0 when the path is missing ("0 file(s) scanned").
    assert.equal(parsed.childRestored, 0)
    assert.notEqual(parsed.childRestored, parsed.wrapper)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('footgun proof: restored fixture present, child and wrapper exits differ on success', () => {
  const root = tempDir('gate-proof-')
  try {
    const r = runProof(FOOTGUN, { [ENV_ROOT]: root })
    const parsed = parseResult(r.stdout)
    assert.equal(r.status, 0)
    assert.equal(parsed.wrapper, 0)
    assert.equal(parsed.childNegative, 1)
    assert.equal(parsed.childRestored, 0)
    assert.notEqual(parsed.childNegative, parsed.wrapper)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('default proof runs do not create or delete files in the live checkout', () => {
  const tmp = tempDir('gate-proof-tmp-')
  const plant = join(SOURCE_REPO_ROOT, PLANT)
  const viteDir = join(SOURCE_REPO_ROOT, 'node_modules/vite')
  const hadPlant = existsSync(plant)
  const hadVite = existsSync(viteDir)
  const before = spawnSync('git', ['status', '--porcelain'], { cwd: SOURCE_REPO_ROOT, encoding: 'utf8' })
  assert.equal(before.status, 0, before.stderr)
  try {
    for (const proof of [DIST, ROOT, COMP, FOOTGUN]) {
      const r = runProof(proof, { TMPDIR: tmp, TMP: tmp, TEMP: tmp })
      assert.equal(r.status, 0, `${proof} failed:\n${r.stdout}\n${r.stderr}`)
      const parsed = parseResult(r.stdout)
      assert.equal(parsed.wrapper, 0)
      assert.equal(parsed.childNegative, 1)
      assert.equal(parsed.childRestored, 0)
      assert.notEqual(parsed.childNegative, parsed.wrapper)
    }
    assert.deepEqual(readdirSync(tmp), [])
    assert.equal(existsSync(plant), hadPlant)
    assert.equal(existsSync(viteDir), hadVite)
    const after = spawnSync('git', ['status', '--porcelain'], { cwd: SOURCE_REPO_ROOT, encoding: 'utf8' })
    assert.equal(after.status, 0, after.stderr)
    assert.equal(after.stdout, before.stdout)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
