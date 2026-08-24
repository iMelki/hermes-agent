// hermes-web capture — read-only. Issues GETs only. Does not start/stop/configure anything.
import { chromium } from 'file:///S:/source/CCAI/Assistants/tools/content-factory/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {
  captureBundleProvenance,
  verifyProvenance,
  selfTest as provenanceSelfTest,
  negativeControl as provenanceNegativeControl,
} from '../lib/bundle-provenance.mjs';

// Overridable so the provenance gate below can be pointed at a fixture and
// PROVEN to reject. A gate that can only ever be aimed at the healthy live
// dashboard is a gate nobody can demonstrate failing.
const BASE = process.env.HERMES_WEB_BASE || 'http://127.0.0.1:9119';
const OUT = process.argv[2];
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
  '/sessions', '/files', '/analytics', '/models', '/logs', '/cron', '/skills',
  '/plugins', '/mcp', '/pairing', '/channels', '/webhooks', '/system',
  '/profiles', '/config', '/env', '/docs', '/chat', '/profiles/new',
  '/__does_not_exist_control__',
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, dsf: 1 },
  mobile: { width: 390, height: 844, dsf: 2 },
  narrow: { width: 320, height: 800, dsf: 2 },
};

// ---------- in-page probe ----------
const PROBE = () => {
  // Canvas-based colour resolver. The hand-rolled rgb()/color(srgb) parser used in the
  // 2026-08-13 bundle silently returned null for oklab()/oklch(), which this app (Tailwind v4)
  // uses for most surfaces — that produced a fabricated 1.19:1 "invisible text" reading on
  // /skills. Painting the declared colour to a 1x1 canvas makes Chromium do the CSS Color 4
  // conversion for us, so every notation resolves or is explicitly recorded as unresolved.
  let __unresolvedColors = 0;
  const __cv = document.createElement('canvas');
  __cv.width = 1; __cv.height = 1;
  const __cx = __cv.getContext('2d', { willReadFrequently: true });
  const parseColor = (s) => {
    if (!s || s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    __cx.clearRect(0, 0, 1, 1);
    const SENTINEL = 'rgba(1, 2, 3, 0.502)';
    __cx.fillStyle = SENTINEL;
    __cx.fillStyle = s;                    // ignored by the engine if `s` is invalid
    if (__cx.fillStyle === SENTINEL && s !== SENTINEL) { __unresolvedColors++; return null; }
    __cx.fillRect(0, 0, 1, 1);
    const d = __cx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const contrast = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  // Composite the real background stack rather than taking the first >50% layer.
  const effBg = (el) => {
    const layers = [];
    let n = el;
    while (n) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break; }
      n = n.parentElement;
    }
    let base = layers.length && layers[layers.length - 1].a >= 0.999
      ? layers.pop() : { r: 0, g: 0, b: 0, a: 1 }; // canvas ground under a dark app
    for (let i = layers.length - 1; i >= 0; i--) {
      const t = layers[i];
      base = { r: t.r * t.a + base.r * (1 - t.a), g: t.g * t.a + base.g * (1 - t.a), b: t.b * t.a + base.b * (1 - t.a), a: 1 };
    }
    return base;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };

  // ---- OVERFLOW: TWO INDEPENDENT SIGNALS, EACH POSITIVE-CONTROLLED IN THIS RUN ----
  // Signal A = page-level. On hermes-web html/body/#root all carry overflow-x:hidden,
  // so body.scrollWidth is DEAD (proven by control). documentElement is the live signal.
  const readPage = () => ({
    documentElement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    scrollingElement: document.scrollingElement
      ? document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth : null,
    innerWidth: window.innerWidth,
  });
  // Signal B = clipped content. Any element whose own content exceeds its box.
  // Survives overflow:hidden ancestors, which Signal A does not.
  const readClipped = () => {
    const list = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.id && el.id.startsWith('__pc_')) continue;
      const over = el.scrollWidth - el.clientWidth;
      if (over > 1 && visible(el)) {
        const cs = getComputedStyle(el);
        list.push({
          tag: el.tagName, cls: String(el.className || '').slice(0, 50),
          over, overflowX: cs.overflowX,
          scrollable: /(auto|scroll)/.test(cs.overflowX),
        });
      }
    }
    return list;
  };
  // Signal C = elements laid out past the viewport's right edge (visually cut off).
  const readPastViewport = (includeControl) => {
    const vw = window.innerWidth;
    const list = [];
    for (const el of document.querySelectorAll('*')) {
      if (!includeControl && el.id && el.id.startsWith('__pc_')) continue;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width < vw * 3) {
        list.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 50), right: Math.round(r.right), vw });
      }
    }
    return list;
  };

  const baseA = readPage();
  const baseB = readClipped().length;
  const baseC = readPastViewport().length;

  // control A: absolutely positioned 2000px block on body
  const pcA = document.createElement('div');
  pcA.id = '__pc_a__';
  pcA.style.cssText = `position:absolute;top:0;left:0;width:${window.innerWidth + 300}px;height:2px;pointer-events:none;opacity:0.5;`;
  document.body.appendChild(pcA);
  void document.body.offsetWidth;
  const ctrlA = readPage();
  const ctrlC_fromA = readPastViewport(true).length;
  pcA.remove();
  void document.body.offsetWidth;
  const restA = readPage();

  // control B: in-flow 3000px child inside <main> (or #root) — must show up as clipped content
  const host = document.querySelector('main') || document.getElementById('root') || document.body;
  const pcB = document.createElement('div');
  pcB.id = '__pc_b__';
  pcB.style.cssText = 'width:3000px;height:2px;opacity:0.001;flex:none;';
  host.appendChild(pcB);
  void document.body.offsetWidth;
  const ctrlB = readClipped().length;
  pcB.remove();
  void document.body.offsetWidth;
  const restB = readClipped().length;

  const control = {
    signalA_documentElement: { baseline: baseA.documentElement, withControl: ctrlA.documentElement, afterRemoval: restA.documentElement },
    signalA_body_DEAD_CHECK: { baseline: baseA.body, withControl: ctrlA.body, afterRemoval: restA.body },
    signalA_scrollingElement: { baseline: baseA.scrollingElement, withControl: ctrlA.scrollingElement },
    signalB_clippedCount: { baseline: baseB, withControl: ctrlB, afterRemoval: restB },
    signalC_pastViewportCount: { baseline: baseC, withControl: ctrlC_fromA },
    detectorProvenA: ctrlA.documentElement > baseA.documentElement,
    detectorProvenB: ctrlB > baseB,
    detectorProvenC: ctrlC_fromA > baseC,
    bodySignalAlive: ctrlA.body > baseA.body,
    restoredA: restA.documentElement === baseA.documentElement,
    restoredB: restB === baseB,
  };
  control.detectorProven = control.detectorProvenA && control.detectorProvenB && control.detectorProvenC;

  const overflowMeasured = {
    pageOverflowPx: baseA.documentElement,
    clippedElements: readClipped(),
    pastViewportElements: readPastViewport().slice(0, 10),
    pastViewportCount: readPastViewport().length,
    clipStyles: {
      html: getComputedStyle(document.documentElement).overflowX,
      body: getComputedStyle(document.body).overflowX,
      root: document.getElementById('root') ? getComputedStyle(document.getElementById('root')).overflowX : null,
    },
  };
  const lateralScrollers = overflowMeasured.clippedElements.filter((c) => c.scrollable);

  // ---- loaded-content proof ----
  const allEls = document.querySelectorAll('*').length;
  const bodyText = (document.body.innerText || '').trim();
  const counts = {
    elements: allEls,
    links: document.querySelectorAll('a').length,
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input,select,textarea').length,
    svgs: document.querySelectorAll('svg').length,
    canvases: document.querySelectorAll('canvas').length,
    headings: document.querySelectorAll('h1,h2,h3').length,
    textChars: bodyText.length,
    skeletonish: document.querySelectorAll('[class*="skeleton" i],[class*="shimmer" i],[aria-busy="true"]').length,
  };

  // ---- typography roles ----
  const h1 = document.querySelector('h1');
  const roleOf = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
      textTransform: cs.textTransform,
    };
  };
  const monoEl = [...document.querySelectorAll('*')].find((e) =>
    visible(e) && /mono/i.test(getComputedStyle(e).fontFamily) && (e.textContent || '').trim().length > 0);
  const typography = {
    h1Text: h1 ? (h1.innerText || '').trim().slice(0, 80) : null,
    h1: roleOf(h1),
    body: roleOf(document.body),
    mono: roleOf(monoEl),
    loadedFonts: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))].sort(),
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  };

  // ---- hit targets ----
  const SEL = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[tabindex]:not([tabindex="-1"])';
  const ctrls = [...document.querySelectorAll(SEL)].filter(visible);
  const sized = ctrls.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height),
      label: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim().slice(0, 40),
    };
  });
  const under = (n) => sized.filter((s) => s.w < n || s.h < n);
  const hitTargets = {
    total: sized.length,
    under44: under(44).length,
    under24: under(24).length,
    under24Samples: under(24).slice(0, 8),
    under44Samples: under(44).slice(0, 8),
    unlabeledIconOnly: ctrls.filter((el) => {
      const txt = (el.innerText || '').trim();
      const name = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('aria-labelledby');
      return !txt && !name && el.querySelector('svg');
    }).length,
    navLinkSizes: [...document.querySelectorAll('nav a, aside a')].filter(visible).slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
  };

  // ---- minimum rendered text size + contrast ----
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let minPx = Infinity, minSample = null;
  const seen = new Map();
  const pairs = [];
  let n;
  while ((n = walker.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize);
    if (px < minPx) { minPx = px; minSample = { text: t.slice(0, 40), tag: el.tagName, px }; }
    const fg = parseColor(cs.color);
    if (!fg || fg.a < 0.05) continue;
    const bg = effBg(el);
    const key = `${cs.color}|${bg.r},${bg.g},${bg.b}|${px}|${cs.fontWeight}`;
    if (seen.has(key)) { seen.get(key).count++; continue; }
    const ratio = contrast(fg, bg);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const rec = {
      fg: cs.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      px: Math.round(px * 10) / 10, weight: cs.fontWeight,
      ratio: Math.round(ratio * 100) / 100, large,
      pass: ratio >= (large ? 3 : 4.5), sample: t.slice(0, 32), count: 1,
    };
    seen.set(key, rec);
    pairs.push(rec);
  }
  const failing = pairs.filter((p) => !p.pass).sort((a, b) => a.ratio - b.ratio);
  // Positive control for the contrast probe itself, on this page in this run.
  const okWhite = parseColor('oklab(0.938314 0.0158656 0.0420899 / 1)');
  const selfTest = {
    whiteOnBlack: Math.round(contrast(parseColor('rgb(255,255,255)'), parseColor('rgb(0,0,0)')) * 100) / 100,
    sameOnSame: Math.round(contrast(parseColor('rgb(120,120,120)'), parseColor('rgb(120,120,120)')) * 100) / 100,
    oklabResolved: okWhite !== null,
    oklabAsRgb: okWhite ? `rgb(${Math.round(okWhite.r)}, ${Math.round(okWhite.g)}, ${Math.round(okWhite.b)})` : null,
    unresolvedColorStrings: __unresolvedColors,
  };
  selfTest.proven = selfTest.whiteOnBlack === 21 && selfTest.sameOnSame === 1 && selfTest.oklabResolved;
  const contrastReport = {
    selfTest,
    distinctPairs: pairs.length,
    failingPairs: failing.length,
    worst: failing.slice(0, 6),
    bestOfFailing: failing.length ? failing[failing.length - 1].ratio : null,
  };

  // ---- motion ----
  let animated = 0, transitioned = 0;
  const animNames = new Set();
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.animationName && cs.animationName !== 'none') { animated++; cs.animationName.split(',').forEach((a) => animNames.add(a.trim())); }
    const td = cs.transitionDuration || '';
    if (td && td.split(',').some((d) => parseFloat(d) > 0)) transitioned++;
  }
  const motion = {
    prefersReducedMotionMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    elementsWithAnimation: animated,
    animationNames: [...animNames].slice(0, 12),
    elementsWithTransition: transitioned,
    canvases: document.querySelectorAll('canvas').length,
    canvasSizes: [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`),
    videos: document.querySelectorAll('video').length,
  };

  // ---- misc ----
  const externalOrigins = [...new Set(
    [...document.querySelectorAll('[src],[href]')]
      .map((e) => e.getAttribute('src') || e.getAttribute('href'))
      .filter((u) => u && /^https?:\/\//i.test(u))
      .map((u) => { try { return new URL(u).origin; } catch { return null; } })
      .filter((o) => o && o !== location.origin))].sort();
  const emoji = (bodyText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu) || []);

  return {
    url: location.pathname + location.search,
    title: document.title,
    control, overflow: overflowMeasured, lateralScrollers,
    counts, typography, hitTargets,
    minTextPx: minPx === Infinity ? null : Math.round(minPx * 10) / 10,
    minTextSample: minSample,
    contrast: contrastReport, motion,
    externalOrigins,
    emojiCount: emoji.length, emojiSamples: [...new Set(emoji)].slice(0, 8),
    bodyTextHead: bodyText.slice(0, 160).replace(/\s+/g, ' '),
  };
};

const results = [];

const run = async (browser, vpName, routes, opts = {}) => {
  const vp = VIEWPORTS[vpName];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    colorScheme: 'dark',
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
  });
  for (const route of routes) {
    const tag = `${route.replace(/\W+/g, '_').replace(/^_/, '') || 'root'}-${vpName}${opts.reducedMotion ? '-rm' : ''}`;
    const page = await ctx.newPage();
    const console_ = [], pageErrors = [], reqFailed = [], http4xx = [];
    page.on('console', (m) => { if (m.type() === 'error') console_.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
    page.on('requestfailed', (r) => reqFailed.push(`${r.url().slice(0, 120)} ${r.failure()?.errorText || ''}`));
    page.on('response', (r) => { if (r.status() >= 400) http4xx.push(`${r.status()} ${r.url().slice(0, 120)}`); });
    let nav = null, err = null, probe = null;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      nav = { status: resp ? resp.status() : null };
      await page.waitForTimeout(5000);
      try { await page.evaluate(() => document.fonts.ready); } catch {}
      probe = await page.evaluate(PROBE);
      if (opts.shot && (!opts.shotOnly || opts.shotOnly.has(route))) {
        await page.screenshot({ path: path.join(SHOTS, `${tag}.png`), fullPage: false });
      }
    } catch (e) {
      err = String(e).slice(0, 300);
    }
    results.push({
      route, viewport: vpName, reducedMotion: !!opts.reducedMotion, tag,
      nav, error: err,
      consoleErrors: console_.length, pageErrors: pageErrors.length,
      requestsFailed: reqFailed.length, http4xxPlus: http4xx.length,
      consoleSamples: console_.slice(0, 3), pageErrorSamples: pageErrors.slice(0, 3),
      reqFailedSamples: reqFailed.slice(0, 3), http4xxSamples: http4xx.slice(0, 3),
      probe,
    });
    console.log(`${tag} st=${nav?.status} ctrlABC=${probe?.control?.detectorProvenA}/${probe?.control?.detectorProvenB}/${probe?.control?.detectorProvenC} pageOver=${probe?.overflow?.pageOverflowPx} clipped=${probe?.overflow?.clippedElements?.length} pastVP=${probe?.overflow?.pastViewportCount} els=${probe?.counts?.elements} minPx=${probe?.minTextPx} u44=${probe?.hitTargets?.under44}/${probe?.hitTargets?.total} cst=${probe?.contrast?.selfTest?.proven}/${probe?.contrast?.selfTest?.unresolvedColorStrings} fail=${probe?.contrast?.failingPairs}/${probe?.contrast?.distinctPairs} h1=${JSON.stringify(probe?.typography?.h1Text)}`);
    await page.close();
  }
  await ctx.close();
};

const main = async () => {
  // ---- PROVENANCE GATE -----------------------------------------------------
  // Runs BEFORE the browser launches. A capture whose served artifact cannot be
  // identified is unfalsifiable, and a capture of a down / 500ing /
  // login-redirecting dashboard is worse than none: it looks like evidence.
  // Both controls must prove themselves in this run before the verdict is
  // trusted — selfTest proves the digests discriminate, negativeControl proves
  // the verifier can reject (and, via its accept case, that it does not reject
  // everything).
  const provControl = provenanceSelfTest();
  if (!provControl.proven) {
    console.error('ABORT: provenance self-test failed', JSON.stringify(provControl, null, 2));
    process.exitCode = 1;
    return;
  }
  const provNegative = await provenanceNegativeControl();
  if (!provNegative.proven) {
    console.error('ABORT: provenance negative control failed', JSON.stringify(provNegative, null, 2));
    process.exitCode = 1;
    return;
  }
  const provenance = await captureBundleProvenance(BASE);
  const provVerdict = verifyProvenance(provenance);
  if (!provVerdict.ok) {
    console.error(
      `ABORT: ${BASE} did not serve an identifiable Hermes dashboard build; refusing to capture.\n  - ` +
        provVerdict.reasons.join('\n  - ')
    );
    process.exitCode = 2;
    return;
  }
  console.log(
    'PROVENANCE OK entry=' + provenance.entryHtml.sha256Normalized.slice(0, 16) +
    ' assets=' + provenance.assets.map((a) => `${a.url.replace('/assets/', '')}:${a.sha256.slice(0, 16)}`).join(' ')
  );

  const browser = await chromium.launch({ headless: true });
  const shotRoutes = new Set(['/sessions', '/skills', '/system', '/logs', '/profiles', '/config']);
  // Pass A: every route at desktop
  await run(browser, 'desktop', ROUTES, { shot: true, shotOnly: shotRoutes });
  // Pass B: key routes at mobile + narrow
  const key = ['/sessions', '/skills', '/system', '/logs'];
  await run(browser, 'mobile', key, { shot: true });
  await run(browser, 'narrow', key, { shot: true });
  // Pass C: reduced motion desktop
  await run(browser, 'desktop', ['/sessions', '/profiles'], { reducedMotion: true, shot: true });
  await browser.close();

  // ---- POST-CAPTURE LIVENESS RE-ASSERTION ----------------------------------
  // The provenance gate above is a PRE-FLIGHT check: it proves the dashboard was
  // serving an identifiable build at the moment the run started, and then never
  // looks again. That is not enough, and this is not hypothetical. On 2026-08-24
  // a full run started against a healthy 9119 (gate accepted, digests recorded),
  // the gateway stopped answering partway through, and the record still carried
  // provenanceVerdict.ok === true while 13 of its 30 results were
  // `page.goto` timeouts and net::ERR_CONNECTION_REFUSED. A capture of a
  // dashboard that died mid-run looked exactly like a capture of a healthy one —
  // the same fail-open class the pre-flight gate was written to close, one level
  // down. Exhibit: docs/evidence/2026-08-24-midcapture-liveness-gap/.
  //
  // So the target is re-asserted AFTER the browser work, and the results are
  // asserted against themselves. A navigation that threw produced no probe data,
  // so any such result means the numbers in this record describe fewer surfaces
  // than it claims to cover.
  const navFailures = results.filter((r) => r.error || !r.nav);
  const provenanceAfter = await captureBundleProvenance(BASE);
  const provAfterVerdict = verifyProvenance(provenanceAfter);
  if (navFailures.length > 0 || !provAfterVerdict.ok) {
    const lines = [];
    if (navFailures.length > 0) {
      lines.push(
        `CAPTURE_INCOMPLETE: ${navFailures.length} of ${results.length} results have no navigation ` +
        `(${navFailures.slice(0, 5).map((r) => r.tag).join(', ')}${navFailures.length > 5 ? ', …' : ''})`
      );
    }
    if (!provAfterVerdict.ok) {
      lines.push('TARGET_NOT_HEALTHY_AFTER_CAPTURE: ' + provAfterVerdict.reasons.join('; '));
    }
    console.error(
      `ABORT: refusing to write a capture record for a target that did not stay healthy for the whole run.\n  - ` +
      lines.join('\n  - ')
    );
    process.exitCode = 2;
    return;
  }
  const entryBefore = provenance.entryHtml.sha256Normalized;
  const entryAfter = provenanceAfter.entryHtml.sha256Normalized;
  if (entryBefore !== entryAfter) {
    console.error(
      `ABORT: the served build changed during the run (entry ${entryBefore.slice(0, 16)} -> ${entryAfter.slice(0, 16)}); ` +
      'these results describe two different artifacts.'
    );
    process.exitCode = 2;
    return;
  }
  console.log(`PROVENANCE STABLE across the run entry=${entryAfter.slice(0, 16)} navFailures=0`);

  fs.writeFileSync(path.join(OUT, 'telemetry.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    base: BASE,
    harness: 'playwright-core 1.59.1 (chromium headless) via content-factory pnpm store, read-only',
    // Build identity of the artifact the browser actually loaded. web_dist is
    // gitignored and built out-of-band, so these digests are the ONLY thing
    // tying these pixels to an artifact — without them the score is
    // unfalsifiable. provenanceControl/provenanceNegativeControl are recorded
    // alongside so a reader can see the gate proved itself in THIS run.
    provenance,
    provenanceVerdict: provVerdict,
    // The same target, re-measured after the browser work, plus the assertion
    // that no result lost its navigation. Without these two, a record cannot
    // distinguish "the app was healthy throughout" from "the app was healthy for
    // the first request and then fell over".
    provenanceAfter,
    provenanceAfterVerdict: provAfterVerdict,
    captureIntegrity: {
      resultCount: results.length,
      navFailureCount: navFailures.length,
      entrySha256Stable: entryBefore === entryAfter,
    },
    provenanceControl: provControl,
    provenanceNegativeControl: provNegative,
    results,
  }, null, 2));
  console.log('WROTE ' + path.join(OUT, 'telemetry.json'));
};
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
