/**
 * hermes-dashboard fleet gauntlet lane — 2026-08-31 (score-only, LIVE :9119 read-only).
 * Adapted from docs/uiux-awwwards-rescore-2026-08-31/measure.mjs (round-24 canonical probe):
 * two-sentinel sRGB canvas contrast with invalid-colour control, 2.5.8 AA / 2.5.5 AAA both
 * named, in-flow (NOT absolute) overflow positive control, RM 2.2.2 via computed values +
 * information parity. Lane additions: real keyboard Tab pass, Performance API timing,
 * 375x812 mobile viewport, serve-identity hashing (session token stripped before hashing).
 * NO restarts, NO writes to the app, GETs only.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///S:/source/CCAI/Assistants/tools/content-factory/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const LIVE = 'http://127.0.0.1:9119';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function provenance() {
  const out = { fetchedAt: new Date().toISOString(), base: LIVE, sessionTokenStripped: true };
  const res = await fetch(LIVE + '/');
  const raw = await res.text();
  // strip launcher session token before hashing or storing anything
  const normalized = raw.replace(/<script>window\.__HERMES_SESSION_TOKEN__=.*?<\/script>/s, '<script>[TOKEN-SCRIPT-STRIPPED]</script>');
  out.entryHtml = { status: res.status, bytesRaw: Buffer.byteLength(raw), bytesNormalized: Buffer.byteLength(normalized), sha256Normalized: sha256(normalized) };
  const assetRefs = [...raw.matchAll(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g)].map((m) => m[0]);
  out.assets = [];
  for (const url of [...new Set(assetRefs)]) {
    const r = await fetch(LIVE + url);
    const b = Buffer.from(await r.arrayBuffer());
    out.assets.push({ url, status: r.status, bytes: b.length, sha256: sha256(b) });
  }
  // stamp check: pre-stamp bundle falls through /build-info.json to the SPA HTML
  const bi = await fetch(LIVE + '/build-info.json');
  const biText = await bi.text();
  out.buildInfo = {
    status: bi.status,
    contentType: bi.headers.get('content-type'),
    isSpaFallthrough: biText.trimStart().toLowerCase().startsWith('<!doctype html'),
    head: biText.slice(0, 60).replace(/window\.__HERMES_SESSION_TOKEN__="[^"]*"/, 'TOKEN-STRIPPED'),
  };
  out.hasBuildMeta = /hermes-build-/.test(raw);
  return out;
}

async function waitForSurface(page, { minText = 40, maxMs = 45000 } = {}) {
  const deadline = Date.now() + maxMs;
  let last = {};
  while (Date.now() < deadline) {
    last = await page.evaluate(() => {
      const h1 = (document.querySelector('h1')?.innerText || '').trim();
      const rootLen = (document.getElementById('root')?.innerText || '').trim().length;
      return { textLen: rootLen, h1, title: document.title };
    });
    if (last.textLen >= minText && last.h1) return { settled: true, ...last };
    await page.waitForTimeout(400);
  }
  return { settled: false, ...last };
}

const PROBE = ({ withOverflowControl }) => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };

  // --- overflow: settled body signal, in-FLOW positive control (abs was proven blind) ---
  const bodyOverflow = document.body.scrollWidth - document.body.clientWidth;
  const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  let overflowControl = null;
  if (withOverflowControl) {
    const probeEl = document.createElement('div');
    probeEl.style.cssText = 'width:2600px;height:2px;'; // in-flow static
    document.body.appendChild(probeEl);
    const moved = document.body.scrollWidth - document.body.clientWidth;
    probeEl.remove();
    const restored = document.body.scrollWidth - document.body.clientWidth;
    overflowControl = { baseline: bodyOverflow, withInjected2600: moved, restored,
      proven: moved > bodyOverflow + 500 && restored === bodyOverflow };
  }

  // --- typography ---
  const roleOf = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fontFamily: cs.fontFamily.slice(0, 60), fontSize: cs.fontSize, fontWeight: cs.fontWeight };
  };
  const h1 = document.querySelector('h1');

  // --- hit targets: name BOTH criteria ---
  const SEL = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[tabindex]:not([tabindex="-1"])';
  const ctrls = [...document.querySelectorAll(SEL)].filter(visible);
  const sized = ctrls.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const inline = el.tagName === 'A' && cs.display === 'inline';
    return { tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), inline,
      label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 30) };
  });
  const under = (n) => sized.filter((s) => (s.w < n || s.h < n) && !s.inline);
  const under24 = under(24);
  const under44 = under(44);
  const unlabeled = ctrls.filter((el) => el.tagName === 'BUTTON' &&
    !(el.getAttribute('aria-label') || '').trim() && !(el.innerText || '').trim()).length;

  // --- motion (computed values, WCAG 2.2.2 Level A evidence) ---
  let animatedEls = 0; const animNames = new Set(); let infiniteCount = 0;
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.animationName && cs.animationName !== 'none') {
      animatedEls += 1;
      cs.animationName.split(',').forEach((a) => animNames.add(a.trim()));
      if (cs.animationIterationCount.split(',').some((c) => c.trim() === 'infinite')) infiniteCount += 1;
    }
  }
  const runningAnimations = typeof document.getAnimations === 'function' ? document.getAnimations().length : null;

  // --- two-sentinel sRGB canvas contrast; invalid colour must resolve to null (fail-open trap) ---
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const toRgb = (spec) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000'; cx.fillStyle = spec;
    const a = cx.fillStyle;
    cx.fillStyle = '#fff'; cx.fillStyle = spec;
    if (cx.fillStyle !== a) return null; // parser fell back -> UNMEASURABLE, never a pass
    cx.fillStyle = spec; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (f, b) => { const [l1, l2] = [lum(f), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const sentinelHi = toRgb('#ffffff') && toRgb('#000000') ? ratio(toRgb('#ffffff'), toRgb('#000000')) : null;
  const sentinelLo = toRgb('#777777') ? ratio(toRgb('#777777'), toRgb('#777777')) : null;
  const sentinelInvalid = toRgb('not-a-colour');
  const sentinels = {
    hi: sentinelHi, lo: sentinelLo, invalidResolved: sentinelInvalid !== null,
    proven: sentinelHi > 20.9 && sentinelHi < 21.1 && Math.abs(sentinelLo - 1) < 0.01 && sentinelInvalid === null,
  };
  const effBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { unresolved: 'background-image' };
      const c = toRgb(cs.backgroundColor);
      if (c === null) return { unresolved: 'invalid-colour' };
      if (c.a >= 0.99) return { rgb: c };
      if (c.a > 0.01) return { unresolved: 'semi-transparent-stack' };
      n = n.parentElement;
    }
    const rootBg = toRgb(getComputedStyle(document.body).backgroundColor);
    return rootBg && rootBg.a >= 0.99 ? { rgb: rootBg } : { unresolved: 'no-opaque-ancestor' };
  };
  let enumerated = 0, resolved = 0, fails = [], worst = null; const failSet = new Set();
  const textEls = [...document.querySelectorAll('body *')].filter((el) =>
    visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
  for (const el of textEls.slice(0, 400)) {
    enumerated += 1;
    const cs = getComputedStyle(el);
    const fg = toRgb(cs.color);
    if (fg === null) continue;
    const bg = effBg(el);
    if (!bg.rgb) continue;
    resolved += 1;
    const r = ratio(fg, bg.rgb);
    const px = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const req = large ? 3 : 4.5;
    if (!worst || r < worst.ratio) worst = { ratio: +r.toFixed(2), req, text: (el.textContent || '').trim().slice(0, 30) };
    if (r < req) {
      const key = (el.textContent || '').trim().slice(0, 25) + '|' + r.toFixed(1);
      if (!failSet.has(key)) { failSet.add(key); fails.push({ ratio: +r.toFixed(2), req, px, text: key.split('|')[0] }); }
    }
  }

  // --- focus visibility on a sample of controls ---
  const focusSample = [];
  for (const el of ctrls.slice(0, 12)) {
    const before = getComputedStyle(el);
    const b = { o: before.outlineStyle + '/' + before.outlineWidth, bs: before.boxShadow };
    el.focus({ preventScroll: true });
    const after = getComputedStyle(el);
    const changed = (after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0 &&
      (b.o !== after.outlineStyle + '/' + after.outlineWidth)) || (after.boxShadow !== b.bs);
    focusSample.push(changed);
    el.blur();
  }
  const focusVisible = focusSample.filter(Boolean).length;

  // --- performance (Navigation Timing + Paint Timing) ---
  const nav = performance.getEntriesByType('navigation')[0];
  const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, +p.startTime.toFixed(0)]));
  const perf = nav ? {
    ttfbMs: +(nav.responseStart - nav.requestStart).toFixed(0),
    domContentLoadedMs: +nav.domContentLoadedEventEnd.toFixed(0),
    loadEventMs: +(nav.loadEventEnd || 0).toFixed(0),
    transferSize: nav.transferSize,
    firstPaintMs: paints['first-paint'] ?? null,
    firstContentfulPaintMs: paints['first-contentful-paint'] ?? null,
    longTasks: null,
  } : null;

  const bodyText = (document.body.innerText || '').trim();
  return {
    url: location.pathname,
    h1: h1 ? (h1.innerText || '').trim().slice(0, 60) : null,
    typography: { h1: roleOf(h1), body: roleOf(document.body) },
    overflow: { body: bodyOverflow, documentElement: docOverflow, control: overflowControl },
    hitTargets: {
      total: sized.length,
      under24_AA_258: under24.length, under44_AAA_255: under44.length,
      inlineExcluded: sized.filter((s) => s.inline).length,
      under24Samples: under24.slice(0, 5), unlabeledIconButtons: unlabeled,
    },
    motion: { prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      animatedEls, infiniteCount, runningAnimations, animationNames: [...animNames].slice(0, 8) },
    contrast: { sentinels, enumerated, resolved,
      coveragePct: enumerated ? +((resolved / enumerated) * 100).toFixed(1) : 0,
      failures: fails.slice(0, 8), failureCount: fails.length, worst },
    focus: { sampled: focusSample.length, visibleOnFocus: focusVisible },
    perf,
    counts: { textChars: bodyText.length, headings: document.querySelectorAll('h1,h2,h3').length,
      buttons: document.querySelectorAll('button').length, links: document.querySelectorAll('a').length },
    bodyTextHead: bodyText.slice(0, 140).replace(/\s+/g, ' '),
  };
};

const SURFACES = [
  { name: 'sessions-1440', route: '/sessions', vp: { width: 1440, height: 900 }, rm: false, ctl: true, tabs: true },
  { name: 'skills-1440', route: '/skills', vp: { width: 1440, height: 900 }, rm: false },
  { name: 'system-1440', route: '/system', vp: { width: 1440, height: 900 }, rm: false },
  { name: 'chat-1440', route: '/chat', vp: { width: 1440, height: 900 }, rm: false },
  { name: 'analytics-1440', route: '/analytics', vp: { width: 1440, height: 900 }, rm: false },
  { name: 'sessions-375', route: '/sessions', vp: { width: 375, height: 812 }, rm: false, ctl: true },
  { name: 'system-375', route: '/system', vp: { width: 375, height: 812 }, rm: false },
  { name: 'sessions-1440-rm', route: '/sessions', vp: { width: 1440, height: 900 }, rm: true },
  { name: 'sessions-375-rm', route: '/sessions', vp: { width: 375, height: 812 }, rm: true },
];

const main = async () => {
  const prov = await provenance();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const s of SURFACES) {
    const ctx = await browser.newContext({ viewport: s.vp, colorScheme: 'dark',
      reducedMotion: s.rm ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    const rec = { name: s.name, route: s.route, vp: s.vp, rm: s.rm };
    try {
      const resp = await page.goto(LIVE + s.route, { waitUntil: 'commit', timeout: 45000 });
      rec.navStatus = resp ? resp.status() : null;
      const settle = await waitForSurface(page);
      await page.waitForTimeout(900);
      try { await page.evaluate(() => document.fonts.ready); } catch {}
      rec.settled = settle.settled;
      rec.probe = await page.evaluate(PROBE, { withOverflowControl: Boolean(s.ctl) });
      // --- real keyboard Tab pass (lane requirement): 15 presses, record landing + indicator ---
      if (s.tabs) {
        const tabPath = [];
        for (let i = 0; i < 15; i += 1) {
          await page.keyboard.press('Tab');
          tabPath.push(await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return { tag: 'BODY', indicator: false };
            const cs = getComputedStyle(el);
            const indicator = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
            return { tag: el.tagName, label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 24), indicator };
          }));
        }
        rec.tabPass = {
          presses: tabPath.length,
          landedOnBody: tabPath.filter((t) => t.tag === 'BODY').length,
          withVisibleIndicator: tabPath.filter((t) => t.indicator).length,
          path: tabPath,
        };
      }
      rec.consoleErrors = errors.slice(0, 6);
      rec.consoleErrorCount = errors.length;
      const shot = path.join(SHOTS, `live-${s.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      rec.screenshot = path.basename(shot);
      const p = rec.probe;
      console.log(`${s.name} st=${rec.navStatus} settled=${rec.settled} h1=${JSON.stringify(p.h1)} ` +
        `ovr=${p.overflow.body} u24=${p.hitTargets.under24_AA_258}/${p.hitTargets.total} ` +
        `u44=${p.hitTargets.under44_AAA_255} anim=${p.motion.animatedEls}/${p.motion.runningAnimations} ` +
        `contrastFail=${p.contrast.failureCount} cov=${p.contrast.coveragePct}% ` +
        `sent=${p.contrast.sentinels.proven} focus=${p.focus.visibleOnFocus}/${p.focus.sampled} ` +
        `fcp=${p.perf && p.perf.firstContentfulPaintMs} err=${errors.length}` +
        (p.overflow.control ? ` ovrCtl=${p.overflow.control.proven}` : '') +
        (rec.tabPass ? ` tab=${rec.tabPass.withVisibleIndicator}/${rec.tabPass.presses}` : ''));
    } catch (e) {
      rec.error = String(e.message || e).slice(0, 240);
      console.error(`${s.name} FAIL ${rec.error}`);
    }
    results.push(rec);
    await ctx.close();
  }
  await browser.close();
  const out = { capturedAt: new Date().toISOString(),
    live: { base: LIVE, label: 'running Hermes dashboard, read-only GETs, NOT restarted' },
    harness: 'playwright-core 1.59.1 chromium headless; waitUntil=commit; never networkidle; dark scheme',
    provenance: prov,
    surfaces: results };
  fs.writeFileSync(path.join(HERE, 'measure.json'), JSON.stringify(out, null, 2));
  console.log('WROTE ' + path.join(HERE, 'measure.json'));
};
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
