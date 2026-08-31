import { chromium } from 'file:///S:/source/CCAI/Assistants/tools/content-factory/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ headless: true });
async function settle(pg) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const r = await pg.evaluate(() => ({ len: (document.getElementById('root')?.innerText || '').trim().length, h1: (document.querySelector('h1')?.innerText || '').trim() }));
    if (r.len >= 40 && r.h1) return true;
    await pg.waitForTimeout(400);
  }
  return false;
}
async function run(name, opts, fn) {
  const ctx = await b.newContext({ colorScheme: 'dark', ...opts });
  const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:9119/sessions', { waitUntil: 'commit', timeout: 45000 });
  const ok = await settle(pg);
  await pg.waitForTimeout(1200);
  const r = await pg.evaluate(fn);
  console.log(name, 'settled=' + ok, JSON.stringify(r));
  await ctx.close();
}
const countProbe = () => {
  const visible = (el) => { const r2 = el.getBoundingClientRect(); if (r2.width <= 0 || r2.height <= 0) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const SEL = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[tabindex]:not([tabindex="-1"])';
  const ctrls = [...document.querySelectorAll(SEL)].filter(visible);
  const sized = ctrls.map((el) => { const r2 = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { inline: el.tagName === 'A' && cs.display === 'inline', w: Math.round(r2.width), h: Math.round(r2.height), label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 20) }; });
  const u24 = sized.filter((s) => (s.w < 24 || s.h < 24) && !s.inline);
  const anims = document.getAnimations().map((a) => ({ name: a.animationName || null, target: a.effect?.target ? String(a.effect.target.className).slice(0, 30) : null, opacity: a.effect?.target ? getComputedStyle(a.effect.target).opacity : null }));
  return { textChars: (document.body.innerText || '').trim().length, total: sized.length, u24: u24.length,
    sel15: sized.filter((s) => s.label === 'Select session').length, u24sample: u24.slice(0, 3), animCount: anims.length, anims: anims.slice(0, 6) };
};
await run('RM-1440', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, countProbe);
await run('NOPREF-1440', { viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' }, countProbe);
await run('NOPREF-390', { viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' }, countProbe);
await run('NOPREF-375', { viewport: { width: 375, height: 812 }, reducedMotion: 'no-preference' }, countProbe);
await b.close();
