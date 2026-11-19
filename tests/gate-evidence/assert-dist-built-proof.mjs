#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
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

const NAME = 'assert-dist-built'
const SCRIPT = 'apps/desktop/scripts/assert-dist-built.mjs'
const work = openWorktree()
let wrapper = 0
let childNegative = null
let childRestored = null
try {
  copyFromSource(work, SCRIPT)
  copyFromSource(work, 'apps/desktop/scripts/utils.mjs')
  const neg = runNode(work, SCRIPT)
  childNegative = neg.status
  const negText = textOf(neg)
  if (childNegative !== 1 || !/no dist directory/.test(negText)) {
    console.error('negative proof failed', { status: childNegative, text: negText })
    wrapper = 2
  } else if (!skipRestore()) {
    const dist = join(work.root, 'apps/desktop/dist')
    mkdirSync(join(dist, 'assets'), { recursive: true })
    writeFileSync(join(dist, 'index.html'), '<!doctype html><div id=root></div>')
    writeFileSync(join(dist, 'assets', 'index-proof.js'), 'console.log(1)')
  }
  if (wrapper === 0) {
    const pos = runNode(work, SCRIPT)
    childRestored = pos.status
    const posText = textOf(pos)
    if (childRestored !== 0 || !/dist\/index.html \+ assets present/.test(posText)) {
      console.error('restored pass failed', { status: childRestored, text: posText })
      wrapper = 3
    }
  }
  if (wrapper === 0) {
    console.log('assert-dist-built proof: fail-for-right-reason + restored-pass ok')
  }
  console.log(formatResult(NAME, childNegative, childRestored, wrapper))
} finally {
  closeWorktree(work)
}
process.exitCode = wrapper
