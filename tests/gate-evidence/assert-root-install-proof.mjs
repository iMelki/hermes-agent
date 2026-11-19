#!/usr/bin/env node
import { mkdirSync, writeFileSync, rmSync, rmdirSync, existsSync } from 'node:fs'
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

const NAME = 'assert-root-install'
const SCRIPT = 'apps/desktop/scripts/assert-root-install.mjs'
const work = openWorktree()
const nodeModules = join(work.root, 'node_modules')
const viteDir = join(nodeModules, 'vite')
const vitePkg = join(viteDir, 'package.json')

if (existsSync(viteDir)) {
  console.error('refusing to mutate an existing node_modules/vite; run in a clean worktree')
  process.exitCode = 4
  closeWorktree(work)
  // vite already existed: do not delete owner content.
} else {
  const hadNodeModules = existsSync(nodeModules)
  let createdVite = false
  let wrapper = 0
  let childNegative = null
  let childRestored = null
  try {
    copyFromSource(work, SCRIPT)
    const neg = runNode(work, SCRIPT)
    childNegative = neg.status
    const negText = textOf(neg)
    if (childNegative !== 1 || !/npm ci/.test(negText)) {
      console.error('negative proof failed', { status: childNegative, text: negText })
      wrapper = 2
    } else if (!skipRestore()) {
      mkdirSync(nodeModules, { recursive: true })
      mkdirSync(viteDir)
      createdVite = true
      writeFileSync(vitePkg, JSON.stringify({ name: 'vite', version: '0.0.0-proof' }) + '\n', { flag: 'wx' })
    }
    if (wrapper === 0) {
      const pos = runNode(work, SCRIPT)
      childRestored = pos.status
      if (childRestored !== 0) {
        console.error('restored pass failed', { status: childRestored, text: textOf(pos) })
        wrapper = 3
      }
    }
    if (wrapper === 0) {
      console.log('assert-root-install proof: fail-for-right-reason + restored-pass ok')
    }
    console.log(formatResult(NAME, childNegative, childRestored, wrapper))
    process.exitCode = wrapper
  } finally {
    if (createdVite) rmSync(viteDir, { recursive: true, force: true })
    if (!hadNodeModules && existsSync(nodeModules)) {
      try { rmdirSync(nodeModules) } catch { /* not empty: leave it */ }
    }
    closeWorktree(work)
  }
}
