/**
 * First Frontend SOTA gauntlet capture for hermes-web.
 *
 * Isolated loopback only. 1440 + 390. Reduced-motion pass.
 * Never uses networkidle (live-polling dashboard). Settles on h1 / main text.
 *
 *   node gauntlet.mjs
 *
 * Read-only: GETs against an already-serving :9119. Starts nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///S:/source/CCAI/Assistants/tools/content-factory/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
import {
  captureBundleProvenance,
  verifyProvenance,
  selfTest as provenanceSelfTest,
  negativeControl as provenanceNegativeControl,
} from '../evidence/lib/bundle-provenance.mjs';

const BASE = process.env.HERMES_WEB_BASE || 'http://127.0.0.1:9119';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTDIR = path.join(HERE, 'shots');
fs.mkdirSync(SHOTDIR, { recursive: true });

const AUDITED_TIP = '3bea4c4819062f0a7c491a20f6cae13144778422';
const EXPECTED_JS = {
  url: '/assets/index-CAurVnFC.js',
  bytes: 1972319,
  sha256: '99c71e0b32af84b36bd21bf93bd01987c828f3cb3d4a430ab7617137e16a1498',
};
const EXPECTED_CSS = {
  url: '/assets/index-BBNSWGzv.css',
  bytes: 114638,
  sha256: 'ca240640deef6e21cb0322a118f4006e49ad3782d0ee2dcc1aa3cdf75a998ddc',
};

async function waitForSurface(page, { minText = 40, maxMs = 45000 } = {}) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const state = await page.evaluate(({ minText }) => {
      const h1 = (document.querySelector('h1')?.innerText || '').trim();
      const mainLen = (document.querySelector('main')?.innerText || '').trim().length;
      const rootLen = (document.getElementById('root')?.innerText || '').trim().length;
      const textLen = Math.max(mainLen, rootLen);
      const skel = document.querySelectorAll(
        '[class*="skeleton" i],[aria-busy="true"],[role="progressbar"]',
      ).length;
      return { textLen, h1, title: document.title, skel };
    }, { minText });
    if (state.textLen >= minText && state.h1) {
      return { settled: true, ...state };
    }
    await page.waitForTimeout(400);
  }
  const last = await page.evaluate(() => ({
    textLen: Math.max(
      (document.querySelector('main')?.innerText || '').trim().length,
      (document.getElementById('root')?.innerText || '').trim().length,
    ),
    h1: (document.querySelector('h1')?.innerText || '').trim(),
    title: document.title,
  }));
  return { settled: false, ...last };
}

const PROBE = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const h1 = document.querySelector('h1');
  const roleOf = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing,
    };
  };
  const SEL =
    'a[href],button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[tabindex]:not([tabindex="-1"])';
  const ctrls = [...document.querySelectorAll(SEL)].filter(visible);
  const sized = ctrls.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      w: Math.round(r.width),
      h: Math.round(r.height),
      label: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '')
        .trim()
        .slice(0, 40),
    };
  });
  const under = (n) => sized.filter((s) => s.w < n || s.h < n);
  let animated = 0;
  const animNames = new Set();
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.animationName && cs.animationName !== 'none') {
      animated += 1;
      cs.animationName.split(',').forEach((a) => animNames.add(a.trim()));
    }
  }
  const bodyText = (document.body.innerText || '').trim();
  return {
    url: location.pathname + location.search,
    title: document.title,
    h1: h1 ? (h1.innerText || '').trim().slice(0, 80) : null,
    typography: {
      h1: roleOf(h1),
      body: roleOf(document.body),
      loadedFonts: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))].sort(),
    },
    counts: {
      elements: document.querySelectorAll('*').length,
      links: document.querySelectorAll('a').length,
      buttons: document.querySelectorAll('button').length,
      headings: document.querySelectorAll('h1,h2,h3').length,
      textChars: bodyText.length,
      canvases: document.querySelectorAll('canvas').length,
    },
    overflowPx: pageOverflow,
    hitTargets: {
      total: sized.length,
      under24: under(24).length,
      under44: under(44).length,
      under24Samples: under(24).slice(0, 6),
      navLinkSizes: [...document.querySelectorAll('nav a, aside a')]
        .filter(visible)
        .slice(0, 6)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${Math.round(r.width)}x${Math.round(r.height)}`;
        }),
    },
    motion: {
      prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      elementsWithAnimation: animated,
      animationNames: [...animNames].slice(0, 12),
    },
    bodyTextHead: bodyText.slice(0, 160).replace(/\s+/g, ' '),
  };
};

function assetMatch(prov, expected) {
  const a = (prov.assets || []).find((x) => x.url === expected.url);
  return Boolean(a && a.status === 200 && a.bytes === expected.bytes && a.sha256 === expected.sha256);
}

const SURFACES = [
  { name: 'sessions-1440', route: '/sessions', viewport: { width: 1440, height: 900 }, reducedMotion: false },
  { name: 'skills-1440', route: '/skills', viewport: { width: 1440, height: 900 }, reducedMotion: false },
  { name: 'system-1440', route: '/system', viewport: { width: 1440, height: 900 }, reducedMotion: false },
  { name: 'sessions-390', route: '/sessions', viewport: { width: 390, height: 844 }, reducedMotion: false },
  { name: 'sessions-1440-rm', route: '/sessions', viewport: { width: 1440, height: 900 }, reducedMotion: true },
];

const main = async () => {
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
    console.error('ABORT: ' + BASE + ' not an identifiable Hermes dashboard.\n  - ' + provVerdict.reasons.join('\n  - '));
    process.exitCode = 2;
    return;
  }
  if (!assetMatch(provenance, EXPECTED_JS) || !assetMatch(provenance, EXPECTED_CSS)) {
    console.error('ABORT: served bundle does not match audited index-CAurVnFC.js / index-BBNSWGzv.css');
    console.error(JSON.stringify(provenance.assets, null, 2));
    process.exitCode = 2;
    return;
  }
  console.log(
    'PROVENANCE OK entry=' + provenance.entryHtml.sha256Normalized.slice(0, 16) +
      ' js=index-CAurVnFC.js css=index-BBNSWGzv.css auditedTip=' + AUDITED_TIP.slice(0, 12),
  );

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const surface of SURFACES) {
    const ctx = await browser.newContext({
      viewport: surface.viewport,
      colorScheme: 'dark',
      reducedMotion: surface.reducedMotion ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 200)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text().slice(0, 200));
    });
    page.on('response', (res) => {
      if (res.status() === 401) {
        try {
          errors.push(('401 ' + new URL(res.url()).pathname).slice(0, 200));
        } catch {
          errors.push('401');
        }
      }
    });
    const rec = { name: surface.name, route: surface.route, viewport: surface.viewport, reducedMotion: surface.reducedMotion };
    try {
      const resp = await page.goto(BASE + surface.route, { waitUntil: 'commit', timeout: 45000 });
      rec.nav = { status: resp ? resp.status() : null };
      const settle = await waitForSurface(page, { minText: 40 });
      await page.waitForTimeout(800);
      try { await page.evaluate(() => document.fonts.ready); } catch { /* fonts optional */ }
      const probe = await page.evaluate(PROBE);
      rec.settled = settle.settled;
      rec.settleMeta = settle;
      rec.probe = probe;
      rec.pageErrors = errors.slice(0, 10);
      const shot = path.join(SHOTDIR, `${surface.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      rec.screenshot = path.basename(shot);
      console.log(
        `${surface.name} st=${rec.nav.status} settled=${settle.settled} h1=${JSON.stringify(probe.h1)} ` +
          `over=${probe.overflowPx} u24=${probe.hitTargets.under24}/${probe.hitTargets.total} ` +
          `anim=${probe.motion.elementsWithAnimation} rm=${probe.motion.prefersReducedMotion} err=${errors.length}`,
      );
    } catch (e) {
      rec.error = String(e.message || e).slice(0, 300);
      rec.settled = false;
      console.error(`${surface.name} FAIL ${rec.error}`);
    }
    results.push(rec);
    await ctx.close();
  }

  await browser.close();

  const navFailures = results.filter((r) => r.error || !r.nav);
  const provenanceAfter = await captureBundleProvenance(BASE);
  const provAfterVerdict = verifyProvenance(provenanceAfter);
  if (navFailures.length > 0 || !provAfterVerdict.ok) {
    console.error('ABORT: target did not stay healthy for the whole run.');
    if (navFailures.length) console.error('navFailures=' + navFailures.map((r) => r.name).join(','));
    if (!provAfterVerdict.ok) console.error(provAfterVerdict.reasons.join('; '));
    process.exitCode = 2;
    return;
  }
  const before = provenance.entryHtml.sha256Normalized;
  const after = provenanceAfter.entryHtml.sha256Normalized;
  if (before !== after) {
    console.error(`ABORT: served build changed ${before.slice(0, 16)} -> ${after.slice(0, 16)}`);
    process.exitCode = 2;
    return;
  }

  const out = {
    capturedAt: new Date().toISOString(),
    base: BASE,
    auditedTip: AUDITED_TIP,
    harness: 'playwright-core 1.59.1 (chromium headless) via content-factory store; waitUntil=commit; never networkidle',
    recipe: 'isolated-loopback 1440+390 reduced-motion never-networkidle',
    provenance,
    provenanceVerdict: provVerdict,
    provenanceAfter,
    provenanceAfterVerdict: provAfterVerdict,
    provenanceControl: provControl,
    provenanceNegativeControl: provNegative,
    captureIntegrity: {
      resultCount: results.length,
      navFailureCount: navFailures.length,
      entrySha256Stable: before === after,
      servedJsMatchedAudited: true,
    },
    surfaces: results,
  };
  fs.writeFileSync(path.join(HERE, 'gauntlet.json'), JSON.stringify(out, null, 2));
  console.log('WROTE ' + path.join(HERE, 'gauntlet.json'));
};

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
