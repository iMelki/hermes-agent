// Shared helpers for gate-evidence proofs. Proofs spawn the real gate CLI
// inside a temporary worktree so they never create or delete files in the
// live checkout. The wrapper exit status is tracked separately from the
// child CLI status.
import { cpSync, existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function foldsCase(platform = process.platform) {
  return platform === 'win32' || platform === 'darwin'
}

// Canonicalize a path: realpath the nearest existing ancestor, then append
// any missing suffix. This follows symlinks that lexical resolve() would miss.
export function resolveRealPath(input) {
  const absolute = resolve(input)
  const missing = []
  let cursor = absolute
  while (!existsSync(cursor)) {
    const parent = dirname(cursor)
    if (parent === cursor) break
    missing.push(cursor.slice(parent.length).replace(/^[\\/]/, ''))
    cursor = parent
  }
  let real = cursor
  try {
    real = realpathSync(cursor)
  } catch {
    // Broken symlink, permissions, or an unresolvable root — keep the lexical path.
  }
  return missing.length ? join(real, ...missing.reverse()) : real
}

function nearestExistingIdentity(input) {
  let cursor = resolve(input)
  while (!existsSync(cursor)) {
    const parent = dirname(cursor)
    if (parent === cursor) return null
    cursor = parent
  }
  try {
    const real = realpathSync(cursor)
    const st = statSync(real)
    return { dev: st.dev, ino: st.ino, path: real }
  } catch {
    return null
  }
}

export const SOURCE_REPO_ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'))
export const ENV_ROOT = 'HERMES_GATE_EVIDENCE_ROOT'
export const ENV_SKIP_RESTORE = 'HERMES_GATE_EVIDENCE_SKIP_RESTORE'

export function skipRestore() {
  return process.env[ENV_SKIP_RESTORE] === '1'
}

export function isInside(parent, child) {
  const parentReal = resolveRealPath(parent)
  const childReal = resolveRealPath(child)
  const fold = foldsCase()
  const parentCmp = fold ? parentReal.toLowerCase() : parentReal
  const childCmp = fold ? childReal.toLowerCase() : childReal
  const rel = relative(parentCmp, childCmp)
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return true

  // On Windows and macOS, also accept a match when the nearest existing
  // ancestors are the same device and inode, then compare the remaining
  // suffixes without regard to case.
  if (!fold) return false
  const parentId = nearestExistingIdentity(parent)
  const childId = nearestExistingIdentity(child)
  if (!parentId || !childId || parentId.dev !== childId.dev || parentId.ino !== childId.ino) {
    return false
  }
  const parentRest = relative(parentId.path, parentReal)
  const childRest = relative(childId.path, childReal)
  if (parentRest.startsWith('..') || isAbsolute(parentRest) || childRest.startsWith('..') || isAbsolute(childRest)) {
    return false
  }
  const restRel = relative(parentRest.toLowerCase(), childRest.toLowerCase())
  return restRel === '' || (!restRel.startsWith('..') && !isAbsolute(restRel))
}

export function openWorktree() {
  const given = process.env[ENV_ROOT]
  if (given) {
    // The same realpath / case / inode check applies to HERMES_GATE_EVIDENCE_ROOT.
    if (isInside(SOURCE_REPO_ROOT, given)) {
      throw new Error('refusing to use the live checkout (or a path inside it) as the proof worktree')
    }
    const root = resolveRealPath(given)
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
