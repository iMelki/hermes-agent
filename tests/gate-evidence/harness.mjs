// Shared helpers for gate-evidence proofs. Proofs spawn the real gate CLI
// inside a temporary worktree so they never create or delete files in the
// live checkout. The wrapper exit status is tracked separately from the
// child CLI status.
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const SOURCE_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const ENV_ROOT = 'HERMES_GATE_EVIDENCE_ROOT'
export const ENV_SKIP_RESTORE = 'HERMES_GATE_EVIDENCE_SKIP_RESTORE'

export function skipRestore() {
  return process.env[ENV_SKIP_RESTORE] === '1'
}

export function isInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export function openWorktree() {
  const given = process.env[ENV_ROOT]
  if (given) {
    const root = resolve(given)
    if (isInside(SOURCE_REPO_ROOT, root)) {
      throw new Error('refusing to use the live checkout (or a path inside it) as the proof worktree')
    }
    return { root, ephemeral: false }
  }
  return { root: mkdtempSync(join(tmpdir(), 'hermes-gate-evidence-')), ephemeral: true }
}

export function closeWorktree(work) {
  if (work.ephemeral) rmSync(work.root, { recursive: true, force: true })
}

export function copyFromSource(work, rel) {
  const dest = join(work.root, rel)
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(join(SOURCE_REPO_ROOT, rel), dest, { recursive: true })
  return dest
}

export function runNode(work, scriptRel) {
  return spawnSync(process.execPath, [join(work.root, scriptRel)], {
    cwd: work.root,
    encoding: 'utf8',
  })
}

export function runPython(work, scriptRel, args = []) {
  return spawnSync('python3', [join(work.root, scriptRel), ...args], {
    cwd: work.root,
    encoding: 'utf8',
  })
}

export function formatResult(name, childNegative, childRestored, wrapper) {
  const neg = childNegative == null ? 'null' : String(childNegative)
  const restored = childRestored == null ? 'null' : String(childRestored)
  return `${name} proof: child_negative=${neg} child_restored=${restored} wrapper=${wrapper}`
}

export function textOf(result) {
  return `${result.stdout || ''}${result.stderr || ''}`
}
