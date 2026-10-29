/**
 * hermes-web Awwwards re-score measurement harness — 2026-08-31.
 * Two targets:
 *   SIDE  http://127.0.0.1:9219  — keyless side-serve of STAMPED 24bd9b30c5 (dirty:false)
 *   LIVE  http://127.0.0.1:9119  — running Hermes dashboard (unstamped pre-fix bundle,
 *                                  JS byte-identical sha256 89bc089d…; read-only GETs only)
 * Probes: settled rules — overflow = body.scrollWidth - body.clientWidth (+ in-run positive
 * control), 2.5.8 AA 24px vs 2.5.5 AAA 44px both counted and named, two-sentinel sRGB canvas
 * contrast with coverage %, reduced-motion 2.2.2 via computed values + information-survives,
 * focus-visibility delta, console errors, typography roles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///S:/source/CCAI/Assistants/tools/content-factory/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'awwwards-rescore');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const SIDE = 'http://127.0.0.1:9219';
const LIVE = 'http://127.0.0.1:9119';

async function waitForSurface(page, { minText = 40, maxMs = 30000 } = {}) {
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

  // --- overflow: settled body signal, with optional in-run positive control ---
  const bodyOverflow = document.body.scrollWidth - document.body.clientWidth;
  const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  let overflowControl = null;
  if (withOverflowControl) {
    const probeEl = document.createElement('div');
    probeEl.style.cssText = 'position:absolute;left:0;top:0;width:2600px;height:2px;';
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
    const nativeUnstyled = (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type));
    return { tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), inline, nativeUnstyled,
      label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 30) };
  });
  const under = (n) => sized.filter((s) => (s.w < n || s.h < n) && !s.inline);
  const under24 = under(24);
  const under44 = under(44);

  // --- unlabeled icon-only buttons ---
  const unlabeled = ctrls.filter((el) => el.tagName === 'BUTTON' &&
    !(el.getAttribute('aria-label') || '').trim() && !(el.innerText || '').trim()).length;

  // --- motion (computed values, 2.2.2 evidence) ---
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

  // --- two-sentinel sRGB canvas contrast, coverage stated ---
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const toRgb = (spec) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000'; cx.fillStyle = spec;
    const a = cx.fillStyle;
    cx.fillStyle = '#fff'; cx.fillStyle = spec;
    if (cx.fillStyle !== a) return null; // invalid colour: parser fell back → UNMEASURABLE
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
    counts: { textChars: bodyText.length, headings: document.querySelectorAll('h1,h2,h3').length,
      buttons: document.querySelectorAll('button').length, links: document.querySelectorAll('a').length },
    bodyTextHead: bodyText.slice(0, 140).replace(/\s+/g, ' '),
  };
};

const SURFACES = [
  // SIDE-SERVE (stamped 24bd9b30c5, keyless)
  { base: SIDE, tag: 'side', name: 'sessions-1440', route: '/sessions', vp: { width: 1440, height: 900 }, rm: false, ctl: true },
  { base: SIDE, tag: 'side', name: 'skills-1440', route: '/skills', vp: { width: 1440, height: 900 }, rm: false },
  { base: SIDE, tag: 'side', name: 'system-1440', route: '/system', vp: { width: 1440, height: 900 }, rm: false },
  { base: SIDE, tag: 'side', name: 'chat-1440', route: '/chat', vp: { width: 1440, height: 900 }, rm: false },
  { base: SIDE, tag: 'side', name: 'analytics-1440', route: '/analytics', vp: { width: 1440, height: 900 }, rm: false },
  { base: SIDE, tag: 'side', name: 'sessions-768', route: '/sessions', vp: { width: 768, height: 1024 }, rm: false },
  { base: SIDE, tag: 'side', name: 'sessions-390', route: '/sessions', vp: { width: 390, height: 844 }, rm: false, ctl: true },
  { base: SIDE, tag: 'side', name: 'system-390', route: '/system', vp: { width: 390, height: 844 }, rm: false },
  { base: SIDE, tag: 'side', name: 'sessions-1440-rm', route: '/sessions', vp: { width: 1440, height: 900 }, rm: true },
  { base: SIDE, tag: 'side', name: 'system-1440-rm', route: '/system', vp: { width: 1440, height: 900 }, rm: true },
  // LIVE (read-only, real data, unstamped bundle w/ byte-identical JS)
  { base: LIVE, tag: 'live', name: 'sessions-1440', route: '/sessions', vp: { width: 1440, height: 900 }, rm: false },
  { base: LIVE, tag: 'live', name: 'skills-1440', route: '/skills', vp: { width: 1440, height: 900 }, rm: false },
  { base: LIVE, tag: 'live', name: 'system-1440', route: '/system', vp: { width: 1440, height: 900 }, rm: false },
  { base: LIVE, tag: 'live', name: 'sessions-390', route: '/sessions', vp: { width: 390, height: 844 }, rm: false },
  { base: LIVE, tag: 'live', name: 'sessions-1440-rm', route: '/sessions', vp: { width: 1440, height: 900 }, rm: true },
];

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const s of SURFACES) {
    const ctx = await browser.newContext({ viewport: s.vp, colorScheme: 'dark',
      reducedMotion: s.rm ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    const rec = { target: s.tag, name: s.name, route: s.route, vp: s.vp, rm: s.rm };
    try {
      const resp = await page.goto(s.base + s.route, { waitUntil: 'commit', timeout: 30000 });
      rec.navStatus = resp ? resp.status() : null;
      const settle = await waitForSurface(page);
      await page.waitForTimeout(900);
      try { await page.evaluate(() => document.fonts.ready); } catch {}
      rec.settled = settle.settled;
      rec.probe = await page.evaluate(PROBE, { withOverflowControl: Boolean(s.ctl) });
      rec.consoleErrors = errors.slice(0, 6);
      rec.consoleErrorCount = errors.length;
      const shot = path.join(SHOTS, `${s.tag}-${s.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      rec.screenshot = path.basename(shot);
      const p = rec.probe;
      console.log(`${s.tag}/${s.name} st=${rec.navStatus} settled=${rec.settled} h1=${JSON.stringify(p.h1)} ` +
        `ovr=${p.overflow.body} u24=${p.hitTargets.under24_AA_258}/${p.hitTargets.total} ` +
        `u44=${p.hitTargets.under44_AAA_255} anim=${p.motion.animatedEls}/${p.motion.runningAnimations} ` +
        `contrastFail=${p.contrast.failureCount} cov=${p.contrast.coveragePct}% ` +
        `sent=${p.contrast.sentinels.proven} focus=${p.focus.visibleOnFocus}/${p.focus.sampled} err=${errors.length}` +
        (p.overflow.control ? ` ovrCtl=${p.overflow.control.proven}` : ''));
    } catch (e) {
      rec.error = String(e.message || e).slice(0, 240);
      console.error(`${s.tag}/${s.name} FAIL ${rec.error}`);
    }
    results.push(rec);
    await ctx.close();
  }
  await browser.close();
  const out = { capturedAt: new Date().toISOString(),
    sideServe: { base: SIDE, label: 'keyless side-serve, STAMPED commit 24bd9b30c507b2294f72d4cda64140ad1adf48d2 dirty:false' },
    live: { base: LIVE, label: 'running Hermes dashboard, UNSTAMPED pre-fix bundle, JS sha256 89bc089d… byte-identical to stamped build' },
    harness: 'playwright-core 1.59.1 chromium headless; waitUntil=commit; never networkidle; dark scheme',
    surfaces: results };
  fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(out, null, 2));
  console.log('WROTE ' + path.join(OUT, 'measure.json'));
};
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
