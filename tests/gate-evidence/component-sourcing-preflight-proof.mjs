#!/usr/bin/env node
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  openWorktree,
  closeWorktree,
  copyFromSource,
  runNode,
  skipRestore,
  formatResult,
  textOf,
} from './harness.mjs'

const NAME = 'component-sourcing-preflight'
const SCRIPT = 'scripts/verify-component-sourcing-preflight.mjs'
const PLANT = 'web/src/components/_gate_evidence_uncovered.tsx'
const work = openWorktree()
const plant = join(work.root, PLANT)
let wrapper = 0
let childNegative = null
let childRestored = null
let createdPlant = false
try {
  copyFromSource(work, SCRIPT)
  copyFromSource(work, 'docs/preflight')
  copyFromSource(work, 'web/src/components')

  if (existsSync(plant)) {
    console.error('refusing to overwrite existing plant path; run in a clean worktree')
    wrapper = 4
  } else {
    mkdirSync(join(work.root, 'web/src/components'), { recursive: true })
    writeFileSync(plant, 'export default function GateEvidenceUncovered(){ return null }\n', { flag: 'wx' })
    createdPlant = true
    const neg = runNode(work, SCRIPT)
    childNegative = neg.status
    const negText = textOf(neg)
    if (
      childNegative !== 1
      || !/COMPONENT_SOURCING_PREFLIGHT=fail/.test(negText)
      || !/_gate_evidence_uncovered\.tsx/.test(negText)
    ) {
      console.error('negative proof failed', { status: childNegative, text: negText })
      wrapper = 2
    } else if (!skipRestore()) {
      unlinkSync(plant)
      createdPlant = false
    }
    if (wrapper === 0) {
      const pos = runNode(work, SCRIPT)
      childRestored = pos.status
      const posText = textOf(pos)
      if (childRestored !== 0 || !/COMPONENT_SOURCING_PREFLIGHT=pass/.test(posText)) {
        console.error('restored pass failed', { status: childRestored, text: posText })
        wrapper = 3
      }
    }
  }
  if (wrapper === 0) {
    console.log('component-sourcing-preflight proof: fail-for-right-reason + restored-pass ok')
  }
  if (wrapper !== 4) {
    console.log(formatResult(NAME, childNegative, childRestored, wrapper))
  }
} finally {
  if (createdPlant && existsSync(plant)) unlinkSync(plant)
  closeWorktree(work)
}
process.exitCode = wrapper
