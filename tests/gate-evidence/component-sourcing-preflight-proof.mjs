#!/usr/bin/env node
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const plant = join(repoRoot, 'web/src/components/_gate_evidence_uncovered.tsx')
const script = join(repoRoot, 'scripts/verify-component-sourcing-preflight.mjs')

function run() {
  return spawnSync(process.execPath, [script], { cwd: repoRoot, encoding: 'utf8' })
}

try {
  writeFileSync(plant, 'export default function GateEvidenceUncovered(){ return null }\n')
  const neg = run()
  if (neg.status !== 1 || !/COMPONENT_SOURCING_PREFLIGHT=fail/.test(neg.stderr + neg.stdout) || !/_gate_evidence_uncovered\.tsx/.test(neg.stderr + neg.stdout)) {
    console.error('negative proof failed', { status: neg.status, out: neg.stdout, err: neg.stderr })
    process.exit(2)
  }
} finally {
  if (existsSync(plant)) unlinkSync(plant)
}

const pos = run()
if (pos.status !== 0 || !/COMPONENT_SOURCING_PREFLIGHT=pass/.test(pos.stdout + pos.stderr)) {
  console.error('restored pass failed', { status: pos.status, out: pos.stdout, err: pos.stderr })
  process.exit(3)
}
console.log('component-sourcing-preflight proof: fail-for-right-reason + restored-pass ok')
