#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkDistBuilt } from '../../apps/desktop/scripts/assert-dist-built.mjs'

const root = mkdtempSync(join(tmpdir(), 'hermes-assert-dist-proof-'))
try {
  const missing = checkDistBuilt(join(root, 'missing-dist'))
  if (missing.ok || !/no dist directory/.test(missing.error || '')) {
    console.error('expected missing-dist failure, got', missing)
    process.exit(2)
  }
  const dist = join(root, 'dist')
  mkdirSync(join(dist, 'assets'), { recursive: true })
  writeFileSync(join(dist, 'index.html'), '<!doctype html><div id=root></div>')
  writeFileSync(join(dist, 'assets', 'index-proof.js'), 'console.log(1)')
  const ok = checkDistBuilt(dist)
  if (!ok.ok) {
    console.error('expected restored pass, got', ok)
    process.exit(3)
  }
  console.log('assert-dist-built proof: fail-for-right-reason + restored-pass ok')
} finally {
  rmSync(root, { recursive: true, force: true })
}
