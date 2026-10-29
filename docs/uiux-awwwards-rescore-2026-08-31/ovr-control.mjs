import { chromium } from 'file:///S:/source/CCAI/Assistants/tools/content-factory/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
const targets = [
  ['side', 'http://127.0.0.1:9219/sessions', {width:1440,height:900}],
  ['side-390', 'http://127.0.0.1:9219/sessions', {width:390,height:844}],
  ['live', 'http://127.0.0.1:9119/sessions', {width:1440,height:900}],
  ['live-390', 'http://127.0.0.1:9119/sessions', {width:390,height:844}],
];
const b = await chromium.launch({headless:true});
for (const [tag,url,vp] of targets) {
  const ctx = await b.newContext({viewport:vp,colorScheme:'dark'});
  const pg = await ctx.newPage();
  await pg.goto(url,{waitUntil:'commit',timeout:30000});
  await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => {
    const sig = () => document.body.scrollWidth - document.body.clientWidth;
    const baseline = sig();
    const d = document.createElement('div');
    d.style.cssText = 'width:2600px;height:2px;'; // in-flow static
    document.body.appendChild(d);
    const moved = sig();
    d.remove();
    const restored = sig();
    const csB = getComputedStyle(document.body), csH = getComputedStyle(document.documentElement);
    return { baseline, moved, restored, proven: moved > baseline + 500 && restored === baseline,
      bodyOverflowX: csB.overflowX, htmlOverflowX: csH.overflowX,
      bodyW: document.body.clientWidth, docOvr: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(tag, JSON.stringify(r));
  await ctx.close();
}
await b.close();
