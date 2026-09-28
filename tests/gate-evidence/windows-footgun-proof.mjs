#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const checker = join(repoRoot, 'scripts/check-windows-footguns.py')
const bad = join(repoRoot, 'tests/gate-evidence/windows-footgun/deliberate_os_kill.py')
const good = join(repoRoot, 'tests/gate-evidence/windows-footgun/restored_os_kill.py')

function run(target) {
  return spawnSync('python3', [checker, target], { cwd: repoRoot, encoding: 'utf8' })
}

const neg = run(bad)
const negText = neg.stdout + neg.stderr
if (neg.status !== 1 || !/os\.kill\(pid, 0\)/.test(negText) || !/Windows footgun/.test(negText)) {
  console.error('negative proof failed', { status: neg.status, text: negText })
  process.exit(2)
}
const pos = run(good)
if (pos.status !== 0 || !/No Windows footguns found/.test(pos.stdout + pos.stderr)) {
  console.error('restored pass failed', { status: pos.status, text: pos.stdout + pos.stderr })
  process.exit(3)
}
console.log('windows-footgun proof: fail-for-right-reason + restored-pass ok')
