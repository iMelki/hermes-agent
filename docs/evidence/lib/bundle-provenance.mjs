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
      // `redirect` defaults to "follow" (WHATWG Fetch / MDN RequestInit), so an
      // auth gate that 302s to /login arrives here as status 200 carrying the
      // login page. Status alone therefore CANNOT detect it. Response.redirected
      // is true iff a redirect was followed and Response.url is "the final URL
      // after redirects" (MDN Response.redirected / Response.url) — verified
      // empirically on node v24.18.0/undici: 302->/login yields
      // {status:200, redirected:true, url:".../login"}.
      return { status: r.status, body, redirected: r.redirected, finalUrl: r.url };
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
      redirected: idx.redirected,
      finalUrl: idx.finalUrl,
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
// VERIFIER — this is what makes the recorder capable of failing.
//
// The recorder as originally shipped was fail-open: captureBundleProvenance()
// swallows every error into out.error and returns an object, and the CLI gated
// only on selfTest(). Pointed at a dead port it therefore printed
// control.proven=true with a null provenance block and EXITED 0. Wired into a
// capture harness as-is it would have let a down, 500ing or login-redirecting
// dashboard pass a capture — the exact failure it was built to prevent.
//
// Each rejection carries a NAMED reason so a failure says which invariant broke
// rather than just "false".
// ---------------------------------------------------------------------------
export const verifyProvenance = (prov) => {
  const reasons = [];
  if (!prov || typeof prov !== 'object') {
    return { ok: false, reasons: ['NO_PROVENANCE_OBJECT'] };
  }
  if (prov.error) reasons.push(`FETCH_FAILED: ${prov.error}`);
  const e = prov.entryHtml;
  if (!e) {
    reasons.push('NO_ENTRY_HTML: the entry document was never retrieved');
  } else {
    // Catches a 500, a 404, or any non-OK entry document.
    if (e.status !== 200) reasons.push(`ENTRY_STATUS_NOT_200: got ${e.status}`);
    // Catches an auth gate. fetch follows redirects by default, so a login
    // redirect would otherwise arrive as a perfectly healthy-looking 200.
    if (e.redirected === true) {
      reasons.push(`ENTRY_REDIRECTED: request was redirected to ${e.finalUrl} — served document is not the dashboard entry`);
    }
  }
  // Catches a login page / error page / placeholder: it renders, but it is not
  // a Vite build, so it references no hashed /assets/ output.
  if (!Array.isArray(prov.assets) || prov.assets.length === 0) {
    reasons.push('NO_BUILD_ASSETS: entry document references no /assets/ build output');
  } else {
    for (const a of prov.assets) {
      if (a.status !== 200) reasons.push(`ASSET_NOT_200: ${a.url} -> ${a.status}`);
      if (!a.sha256) reasons.push(`ASSET_NOT_HASHED: ${a.url}`);
    }
  }
  // Catches anything that is not the real Hermes dashboard entry: only the
  // launcher injects the window.__HERMES_* bootstrap. If nothing was stripped,
  // we did not fetch the dashboard.
  if (prov.sessionTokenStripped !== true) {
    reasons.push('NO_SESSION_BOOTSTRAP: no injected window.__HERMES_* script found — this is not the Hermes dashboard entry');
  }
  return { ok: reasons.length === 0, reasons };
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

// ---------------------------------------------------------------------------
// NEGATIVE CONTROL — proves the verifier can actually REJECT, and (critically)
// that it does not reject everything.
//
// A gate that returns ok:false unconditionally would pass every negative test
// while being just as useless as one that always passes. So the ACCEPT case is
// part of the control: a well-formed fake dashboard must be accepted, and each
// broken one must be rejected FOR ITS OWN NAMED REASON. Asserting the reason
// (not merely ok===false) is what stops a single blanket failure from
// masquerading as three independent proofs.
//
// Runs against ephemeral loopback servers this function starts and stops
// itself. It never touches the real gateway.
// ---------------------------------------------------------------------------
const GOOD_ENTRY =
  '<!doctype html><html><head><script>window.__HERMES_SESSION_TOKEN__="LIVE";</script>' +
  '<script type="module" src="/assets/index-GOOD.js"></script>' +
  '<link rel="stylesheet" href="/assets/index-GOOD.css"></head><body><div id="root"></div></body></html>';

const startServer = async (handler) => {
  const { createServer } = await import('node:http');
  const srv = createServer(handler);
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
};

// Close and WAIT. Calling process.exit() while these loopback handles are still
// mid-close trips a libuv assertion on Windows
// ("!(handle->flags & UV_HANDLE_CLOSING), src\\win\\async.c"), which aborts the
// process with status 127 instead of the intended exit code. A gate whose exit
// status depends on teardown timing is not a gate, so every fixture server is
// fully closed before the verdict is returned.
const stopServer = (srv) =>
  new Promise((res) => {
    srv.closeAllConnections?.();
    srv.close(res);
  });

export const negativeControl = async () => {
  const cases = [];
  const record = (name, expect, reasons, ok) =>
    cases.push({
      name,
      expectedVerdict: expect,
      actualVerdict: ok ? 'accept' : 'reject',
      matchedReason: expect === 'accept' ? null : (reasons.find((r) => r.startsWith(expect)) ?? null),
      reasons,
      passed:
        expect === 'accept'
          ? ok === true
          : ok === false && reasons.some((r) => r.startsWith(expect)),
    });

  // --- CONTROL OF THE CONTROL: a healthy dashboard must be ACCEPTED ---
  {
    const { srv, base } = await startServer((req, res) => {
      if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(GOOD_ENTRY); return; }
      if (req.url.startsWith('/assets/')) { res.writeHead(200); res.end('console.log(1)'); return; }
      res.writeHead(404); res.end();
    });
    const v = verifyProvenance(await captureBundleProvenance(base, { timeoutMs: 5000 }));
    record('healthy dashboard (accept case)', 'accept', v.reasons, v.ok);
    await stopServer(srv);
  }

  // --- 1. DEAD PORT: bind then close, so the port is definitively closed ---
  {
    const { srv, base } = await startServer((_q, s) => { s.writeHead(200); s.end('x'); });
    await new Promise((r) => srv.close(r));
    const v = verifyProvenance(await captureBundleProvenance(base, { timeoutMs: 5000 }));
    record('dead port', 'FETCH_FAILED', v.reasons, v.ok);
  }

  // --- 2. HTTP 500 ---
  {
    const { srv, base } = await startServer((_q, res) => {
      res.writeHead(500, { 'content-type': 'text/html' });
      res.end('<html><body>Internal Server Error</body></html>');
    });
    const v = verifyProvenance(await captureBundleProvenance(base, { timeoutMs: 5000 }));
    record('http 500', 'ENTRY_STATUS_NOT_200', v.reasons, v.ok);
    await stopServer(srv);
  }

  // --- 3. LOGIN REDIRECT: 302 -> /login, which fetch FOLLOWS into a 200 ---
  {
    const { srv, base } = await startServer((req, res) => {
      if (req.url === '/') { res.writeHead(302, { Location: '/login' }); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><body><form>Sign in</form></body></html>');
    });
    const prov = await captureBundleProvenance(base, { timeoutMs: 5000 });
    const v = verifyProvenance(prov);
    record('login redirect', 'ENTRY_REDIRECTED', v.reasons, v.ok);
    // Proves the point: the login page came back as a healthy-looking 200.
    cases[cases.length - 1].observedEntryStatus = prov.entryHtml?.status ?? null;
    cases[cases.length - 1].observedRedirected = prov.entryHtml?.redirected ?? null;
    await stopServer(srv);
  }

  return { proven: cases.every((c) => c.passed), cases };
};

// CLI: node bundle-provenance.mjs [base]
// Use pathToFileURL rather than string-concatenating "file://" + argv[1]:
// on Windows the latter yields file://S:/... (two slashes) while import.meta.url
// is file:///S:/... (three), so the guard never matches and the CLI exits
// silently with status 0 — a failure mode that looks exactly like success.
// process.argv[1] is undefined when this module is imported from an eval
// context (`node -e "import(...)"`), and pathToFileURL(undefined) THROWS
// ERR_INVALID_ARG_TYPE — which crashed the whole import rather than skipping
// the CLI block. Guard the presence of argv[1] before converting it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] || 'http://127.0.0.1:9119';
  // Exit codes: 0 accepted | 1 control failed | 2 provenance rejected.
  // process.exitCode (not process.exit) so the loop drains and the status is
  // deterministic rather than a race against handle teardown.
  const control = selfTest();
  if (!control.proven) {
    console.error('CONTROL FAILED', JSON.stringify(control, null, 2));
    process.exitCode = 1;
  } else {
    const negative = await negativeControl();
    if (!negative.proven) {
      console.error('NEGATIVE CONTROL FAILED', JSON.stringify(negative, null, 2));
      process.exitCode = 1;
    } else {
      const prov = await captureBundleProvenance(base);
      const verdict = verifyProvenance(prov);
      console.log(JSON.stringify({ control, negative, provenance: prov, verdict }, null, 2));
      // THE FIX: exit status now depends on the CAPTURE, not just the self-test.
      if (!verdict.ok) {
        console.error('PROVENANCE REJECTED:\n  - ' + verdict.reasons.join('\n  - '));
        process.exitCode = 2;
      }
    }
  }
}
