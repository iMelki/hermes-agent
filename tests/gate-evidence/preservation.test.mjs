// Regression: gate-evidence proofs must preserve pre-existing owner content.
// Runs each proof in an isolated temp repo with stub target scripts; never the live checkout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function fixture(proof, stubRel, stubBody) {
  const root = mkdtempSync(join(tmpdir(), 'gate-proof-'))
  mkdirSync(join(root, 'tests/gate-evidence'), { recursive: true })
  copyFileSync(join(here, proof), join(root, 'tests/gate-evidence', proof))
  mkdirSync(join(root, dirname(stubRel)), { recursive: true })
  writeFileSync(join(root, stubRel), stubBody)
  return root
}
const runProof = (root, proof) => spawnSync(process.execPath, [join(root, 'tests/gate-evidence', proof)], { cwd: root, encoding: 'utf8' })

const ROOT = 'assert-root-install-proof.mjs'
const rootStub = (exitPositive) => `import {existsSync} from 'node:fs'
if (!existsSync('node_modules/vite/package.json')) { console.error('run npm ci'); process.exit(1) }
process.exit(${exitPositive})\n`

for (const [label, exitPositive] of [['success', 0], ['child failure', 7]]) {
  test(`root-install: partial node_modules/vite without package.json survives (${label})`, () => {
    const root = fixture(ROOT, 'apps/desktop/scripts/assert-root-install.mjs', rootStub(exitPositive))
    try {
      mkdirSync(join(root, 'node_modules/vite'), { recursive: true })
      writeFileSync(join(root, 'node_modules/vite/cache.bin'), 'owner-bytes')
      const r = runProof(root, ROOT)
      assert.equal(r.status, 4)
      assert.equal(readFileSync(join(root, 'node_modules/vite/cache.bin'), 'utf8'), 'owner-bytes')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  test(`root-install: sibling node_modules content survives and only proof files are removed (${label})`, () => {
    const root = fixture(ROOT, 'apps/desktop/scripts/assert-root-install.mjs', rootStub(exitPositive))
    try {
      mkdirSync(join(root, 'node_modules/other'), { recursive: true })
      writeFileSync(join(root, 'node_modules/other/keep.txt'), 'owner-bytes')
      const r = runProof(root, ROOT)
      assert.equal(r.status, exitPositive === 0 ? 0 : 3)
      assert.equal(readFileSync(join(root, 'node_modules/other/keep.txt'), 'utf8'), 'owner-bytes')
      assert.equal(existsSync(join(root, 'node_modules/vite')), false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
}

const COMP = 'component-sourcing-preflight-proof.mjs'
const PLANT = 'web/src/components/_gate_evidence_uncovered.tsx'
const compStub = (negExit) => `import {existsSync} from 'node:fs'
if (existsSync('${PLANT}')) { console.log('COMPONENT_SOURCING_PREFLIGHT=fail _gate_evidence_uncovered.tsx'); process.exit(${negExit}) }
console.log('COMPONENT_SOURCING_PREFLIGHT=pass')\n`

for (const [label, negExit] of [['success', 1], ['child failure', 9]]) {
  test(`component proof: pre-existing plant file is never overwritten or removed (${label})`, () => {
    const root = fixture(COMP, 'scripts/verify-component-sourcing-preflight.mjs', compStub(negExit))
    try {
      mkdirSync(join(root, 'web/src/components'), { recursive: true })
      writeFileSync(join(root, PLANT), 'owner tsx')
      const r = runProof(root, COMP)
      assert.equal(r.status, 4)
      assert.equal(readFileSync(join(root, PLANT), 'utf8'), 'owner tsx')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  test(`component proof: cleans only its own plant (${label})`, () => {
    const root = fixture(COMP, 'scripts/verify-component-sourcing-preflight.mjs', compStub(negExit))
    try {
      mkdirSync(join(root, 'web/src/components'), { recursive: true })
      const r = runProof(root, COMP)
      assert.equal(r.status, negExit === 1 ? 0 : 2)
      assert.equal(existsSync(join(root, PLANT)), false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
}
