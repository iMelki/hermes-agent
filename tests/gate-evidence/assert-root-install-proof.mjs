#!/usr/bin/env node
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const script = join(repoRoot, 'apps/desktop/scripts/assert-root-install.mjs')
const vitePkg = join(repoRoot, 'node_modules/vite/package.json')
const hadNodeModules = existsSync(join(repoRoot, 'node_modules'))
const hadVite = existsSync(vitePkg)

function run() {
  return spawnSync(process.execPath, [script], { cwd: repoRoot, encoding: 'utf8' })
}

// Negative: ensure vite package.json absent
if (hadVite) {
  console.error('refusing to mutate an existing node_modules/vite; run in a clean checkout')
  process.exit(4)
}
const neg = run()
if (neg.status !== 1 || !/npm ci/.test(neg.stderr + neg.stdout)) {
  console.error('negative proof failed', { status: neg.status, out: neg.stdout, err: neg.stderr })
  process.exit(2)
}

mkdirSync(join(repoRoot, 'node_modules/vite'), { recursive: true })
writeFileSync(vitePkg, JSON.stringify({ name: 'vite', version: '0.0.0-proof' }) + '\n')
try {
  const pos = run()
  if (pos.status !== 0) {
    console.error('restored pass failed', { status: pos.status, out: pos.stdout, err: pos.stderr })
    process.exit(3)
  }
  console.log('assert-root-install proof: fail-for-right-reason + restored-pass ok')
} finally {
  if (!hadNodeModules) {
    rmSync(join(repoRoot, 'node_modules'), { recursive: true, force: true })
  } else if (!hadVite) {
    rmSync(join(repoRoot, 'node_modules/vite'), { recursive: true, force: true })
  }
}
