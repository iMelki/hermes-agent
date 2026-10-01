#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  createProofFixture, writeFixture, copyGate, runFixtureGate, checkVerdict, retainedFailure,
} from './owned-proof-fixture.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export function proveRootInstall({ sourceRoot = repoRoot, fixtureParent, runChild = runFixtureGate } = {}) {
  const root = createProofFixture('rootinstall', fixtureParent)
  try {
    const gate = copyGate(root, sourceRoot, 'apps/desktop/scripts/assert-root-install.mjs')
    const negative = runChild(gate.target, root)
    checkVerdict(negative, 1, /npm ci/, 'negative root-install')
    writeFixture(root, 'node_modules/vite/package.json',
      JSON.stringify({ name: 'vite', version: '0.0.0-proof' }) + '\n')
    const restored = runChild(gate.target, root)
    checkVerdict(restored, 0, /^\s*$/, 'restored root-install')
    return { status: 'pass', fixtureRoot: root, retained: true,
      sourceSha256: gate.sourceSha256, negativeExit: negative.status, restoredExit: restored.status }
  } catch (error) {
    throw retainedFailure(error, root)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(proveRootInstall()))
  } catch (error) {
    console.error(JSON.stringify({ status: 'fail', reason: error.message, fixtureRoot: error.fixtureRoot }))
    process.exitCode = 1
  }
}
