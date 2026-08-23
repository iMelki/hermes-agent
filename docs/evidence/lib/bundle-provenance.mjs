// Served-bundle provenance recorder for hermes-web captures.
//
// WHY THIS EXISTS
// ---------------
// hermes_cli/web_dist/ is gitignored (.gitignore:68 here, :66 in the runtime
// checkout). The dashboard launcher runs `hermes dashboard --skip-build` and
// REFUSES to start unless a pre-built web_dist already exists, so the served
// bundle is produced out-of-band and is attributable to no commit in any repo.
// Round 6 proved that the audited tree and the serving tree are different
// builds entirely (audited index-DbV3C9Nb.js 1,970,353 B vs served
// index-B4nfmVYw.js 1,588,948 B), yet the round-6 telemetry.json recorded no
// bundle identity at all. Any score derived from those captures is therefore
// unfalsifiable: nothing ties the pixels to an artifact.
//
// This module records the identity of the artifact the browser actually
// loaded, so a capture can be compared against a build later.
//
// READ-ONLY: issues GETs only. Starts, stops and configures nothing.
//
// SECRET HANDLING: the dashboard injects a live per-session bearer token into
// index.html as window.__HERMES_SESSION_TOKEN__. Hashing index.html raw would
// (a) embed a rotating value, making the digest useless as build identity, and
// (b) risk leaking the token into a committed evidence artifact. We therefore
// strip the injected bootstrap script before hashing and never record its
// contents. Asset files carry no session state and are hashed whole.

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// The launcher injects a single bootstrap <script> carrying the session token.
// Remove any inline script that assigns window.__HERMES_* globals.
const INJECTED_BOOTSTRAP =
  /<script>\s*window\.__HERMES_[\s\S]*?<\/script>/gi;

export const normalizeIndexHtml = (html) => html.replace(INJECTED_BOOTSTRAP, '');

// Vite emits hashed asset URLs in the entry HTML. Collect script src and
// stylesheet href that point at the build output.
export const extractAssetUrls = (html) => {
  const urls = new Set();
  const re = /(?:src|href)\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (u.startsWith('/assets/')) urls.add(u);
  }
  return [...urls].sort();
};

/**
 * Fetch the served entry HTML and every build asset it references, and record
 * their digests. Returns a plain object suitable for embedding in telemetry.
 */
export const captureBundleProvenance = async (base, { timeoutMs = 30000 } = {}) => {
  const fetchedAt = new Date().toISOString();
  const get = async (url) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ac.signal });
      const body = Buffer.from(await r.arrayBuffer());
      return { status: r.status, body };
    } finally {
      clearTimeout(t);
    }
  };

  const out = {
    fetchedAt,
    base,
    note: 'web_dist is gitignored and built out-of-band; these digests are the only build identity available to a browser capture.',
    sessionTokenStripped: false,
    entryHtml: null,
    assets: [],
    error: null,
  };

  try {
    const idx = await get(base + '/');
    const raw = idx.body.toString('utf8');
    const normalized = normalizeIndexHtml(raw);
    out.sessionTokenStripped = normalized !== raw;
    out.entryHtml = {
      status: idx.status,
      bytesRaw: idx.body.length,
      bytesNormalized: Buffer.byteLength(normalized, 'utf8'),
      // digest of the build-stable HTML, with injected session state removed
      sha256Normalized: sha256(Buffer.from(normalized, 'utf8')),
    };

    for (const rel of extractAssetUrls(normalized)) {
      try {
        const a = await get(base + rel);
        out.assets.push({
          url: rel,
          status: a.status,
          bytes: a.body.length,
          sha256: sha256(a.body),
        });
      } catch (e) {
        out.assets.push({ url: rel, status: null, bytes: null, sha256: null, error: String(e).slice(0, 200) });
      }
    }
  } catch (e) {
    out.error = String(e).slice(0, 300);
  }

  return out;
};

// ---------------------------------------------------------------------------
// Positive control. A provenance recorder that cannot tell two different builds
// apart is worthless, and this fleet has repeatedly shipped probes that were
// structurally incapable of failing. This control proves, in-run, that the
// digest function discriminates and that the token stripper actually fires.
// ---------------------------------------------------------------------------
export const selfTest = () => {
  const a = Buffer.from('build-A');
  const b = Buffer.from('build-B');
  const digestsDiffer = sha256(a) !== sha256(b);
  const digestStable = sha256(a) === sha256(Buffer.from('build-A'));

  const withToken =
    '<head><title>x</title><script>window.__HERMES_SESSION_TOKEN__="SECRET";window.__HERMES_BASE_PATH__="";</script></head>';
  const without = '<head><title>x</title></head>';
  const stripped = normalizeIndexHtml(withToken);
  const stripperFires = stripped === without;
  const tokenGone = !stripped.includes('SECRET');
  // Two dashboard restarts differ only by token => normalized digest must match.
  const restartA = withToken;
  const restartB = withToken.replace('SECRET', 'DIFFERENT_TOKEN');
  const stableAcrossRestarts =
    sha256(Buffer.from(normalizeIndexHtml(restartA))) ===
    sha256(Buffer.from(normalizeIndexHtml(restartB)));

  const urls = extractAssetUrls(
    '<script src="/assets/index-AAA.js"></script><link href="/assets/index-BBB.css"><img src="/favicon.ico">'
  );
  const extractorFinds = urls.length === 2 && urls.includes('/assets/index-AAA.js');
  const extractorExcludesNonAssets = !urls.includes('/favicon.ico');

  const checks = {
    digestsDiffer,
    digestStable,
    stripperFires,
    tokenGone,
    stableAcrossRestarts,
    extractorFinds,
    extractorExcludesNonAssets,
  };
  return { proven: Object.values(checks).every(Boolean), checks };
};

// CLI: node bundle-provenance.mjs [base]
// Use pathToFileURL rather than string-concatenating "file://" + argv[1]:
// on Windows the latter yields file://S:/... (two slashes) while import.meta.url
// is file:///S:/... (three), so the guard never matches and the CLI exits
// silently with status 0 — a failure mode that looks exactly like success.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] || 'http://127.0.0.1:9119';
  const control = selfTest();
  if (!control.proven) {
    console.error('CONTROL FAILED', JSON.stringify(control, null, 2));
    process.exit(1);
  }
  const prov = await captureBundleProvenance(base);
  console.log(JSON.stringify({ control, provenance: prov }, null, 2));
}
