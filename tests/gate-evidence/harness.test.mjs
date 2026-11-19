// Refuse live-checkout paths offered as HERMES_GATE_EVIDENCE_ROOT, including
// symlink, relative, absolute, and case-changed spellings.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { ENV_ROOT, SOURCE_REPO_ROOT, openWorktree } from './harness.mjs'

function withEnvRoot(value, fn) {
  const prev = process.env[ENV_ROOT]
  if (value === undefined) delete process.env[ENV_ROOT]
  else process.env[ENV_ROOT] = value
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env[ENV_ROOT]
    else process.env[ENV_ROOT] = prev
  }
}

function assertRefuses(value) {
  withEnvRoot(value, () => {
    assert.throws(
      () => openWorktree(),
      (err) => {
        assert.match(String(err && err.message), /refusing to use the live checkout/)
        return true
      },
    )
  })
}

function flipCase(p) {
  return p.replace(/[A-Za-z]/g, (ch) => (
    ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()
  ))
}

test('openWorktree refuses a symlink outside the checkout that points inside', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gate-harness-'))
  const link = join(tmp, 'into-checkout')
  try {
    symlinkSync(SOURCE_REPO_ROOT, link)
    assertRefuses(link)
    // A not-yet-existing child under that symlink must also be refused:
    // the nearest existing parent is realpath'd and the rest is appended.
    assertRefuses(join(link, 'missing-worktree-root'))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('openWorktree refuses a relative path into the checkout', () => {
  const rel = relative(process.cwd(), SOURCE_REPO_ROOT) || '.'
  assertRefuses(rel)
  assertRefuses(join(rel, 'tests'))
})

test('openWorktree refuses an absolute path into the checkout', () => {
  assertRefuses(SOURCE_REPO_ROOT)
  assertRefuses(join(SOURCE_REPO_ROOT, 'tests'))
})

test('openWorktree refuses a case-changed path into the checkout', (t) => {
  const flipped = flipCase(SOURCE_REPO_ROOT)
  assert.notEqual(flipped, SOURCE_REPO_ROOT)

  const caseSensitive = process.platform !== 'win32' && process.platform !== 'darwin'
  if (!caseSensitive) {
    assertRefuses(flipped)
    return
  }

  // Linux paths are case-sensitive, so a flipped spelling is not the same
  // directory here. Simulate win32/darwin so the case-insensitive compare
  // is still exercised, and so this test fails before that compare exists.
  t.diagnostic('case-sensitive Linux: simulating darwin so a case-changed checkout path is treated as the live checkout')
  const orig = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { configurable: true, value: 'darwin' })
  try {
    assertRefuses(flipped)
  } finally {
    if (orig) Object.defineProperty(process, 'platform', orig)
    else delete process.platform
  }
})
