#!/usr/bin/env node
import { join } from 'node:path'
import {
  openWorktree,
  closeWorktree,
  copyFromSource,
  runPython,
  skipRestore,
  formatResult,
  textOf,
} from './harness.mjs'

const NAME = 'windows-footgun'
const CHECKER = 'scripts/check-windows-footguns.py'
const BAD = 'tests/gate-evidence/windows-footgun/deliberate_os_kill.py'
const GOOD = 'tests/gate-evidence/windows-footgun/restored_os_kill.py'
const work = openWorktree()
let wrapper = 0
let childNegative = null
let childRestored = null
try {
  copyFromSource(work, CHECKER)
  copyFromSource(work, BAD)
  if (!skipRestore()) copyFromSource(work, GOOD)

  const neg = runPython(work, CHECKER, [join(work.root, BAD)])
  childNegative = neg.status
  const negText = textOf(neg)
  if (childNegative !== 1 || !/os\.kill\(pid, 0\)/.test(negText) || !/Windows footgun/.test(negText)) {
    console.error('negative proof failed', { status: childNegative, text: negText })
    wrapper = 2
  }
  if (wrapper === 0) {
    const pos = runPython(work, CHECKER, [join(work.root, GOOD)])
    childRestored = pos.status
    const posText = textOf(pos)
    // The checker reports success for a path it cannot find ("0 file(s) scanned"),
    // so require that it actually scanned the one restored fixture.
    if (childRestored !== 0 || !/No Windows footguns found \(1 file\(s\) scanned\)/.test(posText)) {
      console.error('restored pass failed', { status: childRestored, text: posText })
      wrapper = 3
    }
  }
  if (wrapper === 0) {
    console.log('windows-footgun proof: fail-for-right-reason + restored-pass ok')
  }
  console.log(formatResult(NAME, childNegative, childRestored, wrapper))
} finally {
  closeWorktree(work)
}
process.exitCode = wrapper
