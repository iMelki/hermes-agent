#!/usr/bin/env node
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const script = join(repoRoot, 'apps/desktop/scripts/assert-root-install.mjs')
const nodeModules = join(repoRoot, 'node_modules')
const viteDir = join(nodeModules, 'vite')
const vitePkg = join(viteDir, 'package.json')

function run() {
  return spawnSync(process.execPath, [script], { cwd: repoRoot, encoding: 'utf8' })
}

// Refuse to touch ANY pre-existing node_modules/vite path (file or directory,
// with or without package.json). Owner content must never be overwritten or removed.
if (existsSync(viteDir)) {
  console.error('refusing to mutate an existing node_modules/vite; run in a clean checkout')
  process.exit(4)
}

const hadNodeModules = existsSync(nodeModules)
let createdVite = false
let code = 0
try {
  const neg = run()
  if (neg.status !== 1 || !/npm ci/.test(neg.stderr + neg.stdout)) {
    console.error('negative proof failed', { status: neg.status, out: neg.stdout, err: neg.stderr })
    code = 2
  } else {
    mkdirSync(nodeModules, { recursive: true })
    mkdirSync(viteDir) // throws if something appeared meanwhile; never reuse owner content
    createdVite = true
    writeFileSync(vitePkg, JSON.stringify({ name: 'vite', version: '0.0.0-proof' }) + '\n', { flag: 'wx' })
    const pos = run()
    if (pos.status !== 0) {
      console.error('restored pass failed', { status: pos.status, out: pos.stdout, err: pos.stderr })
      code = 3
    } else {
      console.log('assert-root-install proof: fail-for-right-reason + restored-pass ok')
    }
  }
} finally {
  // Remove only what this proof created.
  if (createdVite) rmSync(viteDir, { recursive: true, force: true })
  if (!hadNodeModules && existsSync(nodeModules)) {
    try { rmSync(nodeModules, { recursive: false }) } catch { /* not empty: leave it */ }
  }
}
process.exit(code)
