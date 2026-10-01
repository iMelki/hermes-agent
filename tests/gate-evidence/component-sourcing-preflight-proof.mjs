#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  createProofFixture, writeFixture, copyGate, runFixtureGate, checkVerdict, retainedFailure,
} from './owned-proof-fixture.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const plant = 'web/src/components/_gate_evidence_uncovered.tsx'
const coverageRecord = [
  `Covers: ${plant}`,
  'Target app/surface and component job: isolated gate proof fixture',
  'Target-app component checked: synthetic fixture only',
  'Component marketplace primitive checked: deliberately skipped for synthetic proof',
  'External pools checked or deliberately skipped: deliberately skipped for synthetic proof',
  'Chosen source lane and why: synthetic local guard input, not an adopted UI component',
  'License/access/dependency result: first-party synthetic text; no dependencies',
  'Proof expected before closeout: exact CLI rejection, then coverage acceptance',
].join('\n') + '\n'

export function proveComponentSourcing({ sourceRoot = repoRoot, fixtureParent, runChild = runFixtureGate } = {}) {
  const root = createProofFixture('componentsourcing', fixtureParent)
  try {
    const gate = copyGate(root, sourceRoot, 'scripts/verify-component-sourcing-preflight.mjs')
    writeFixture(root, plant, 'export default function GateEvidenceUncovered(){ return null }\n')
    const negative = runChild(gate.target, root)
    checkVerdict(negative, 1, /COMPONENT_SOURCING_PREFLIGHT=fail/, 'negative component-sourcing')
    checkVerdict(negative, 1, /_gate_evidence_uncovered\.tsx/, 'named uncovered component')
    // Restore validity by adding coverage, not by deleting or moving the plant.
    writeFixture(root, 'docs/preflight/records/synthetic-proof.md', coverageRecord)
    const restored = runChild(gate.target, root)
    checkVerdict(restored, 0, /COMPONENT_SOURCING_PREFLIGHT=pass/, 'restored component-sourcing')
    return { status: 'pass', fixtureRoot: root, retained: true,
      sourceSha256: gate.sourceSha256, negativeExit: negative.status, restoredExit: restored.status }
  } catch (error) {
    throw retainedFailure(error, root)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(proveComponentSourcing()))
  } catch (error) {
    console.error(JSON.stringify({ status: 'fail', reason: error.message, fixtureRoot: error.fixtureRoot }))
    process.exitCode = 1
  }
}
