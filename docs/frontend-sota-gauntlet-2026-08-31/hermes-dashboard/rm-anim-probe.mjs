import { chromium } from 'file:///S:/source/CCAI/Assistants/tools/content-factory/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
const pg = await ctx.newPage();
await pg.goto('http://127.0.0.1:9119/sessions', { waitUntil: 'commit', timeout: 45000 });
await pg.waitForTimeout(3000);
for (const at of [0, 2000, 4000]) {
  if (at) await pg.waitForTimeout(2000);
  const r = await pg.evaluate(() => document.getAnimations().map((a) => ({
    ctor: a.constructor.name,
    name: a.animationName || a.transitionProperty || null,
    playState: a.playState,
    iterations: a.effect?.getTiming?.().iterations ?? null,
    duration: a.effect?.getTiming?.().duration ?? null,
    target: a.effect?.target ? a.effect.target.tagName + '.' + String(a.effect.target.className).slice(0, 40) : null,
  })));
  console.log('t+' + at + 'ms count=' + r.length, JSON.stringify(r));
}
await b.close();
