import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Full-quality visual tour: saves screenshots from several places so the look can be reviewed.
const SCREENS = 'test-results/screens';
fs.mkdirSync(SCREENS, { recursive: true });

test('visual tour at high quality', async ({ page }) => {
  test.setTimeout(480000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?breakdowns=off&quality=high');
  await page.waitForFunction(() => window.__game && window.__game.ready);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.getElementById('start-screen').style.display = 'none'; });
  await page.screenshot({ path: `${SCREENS}/v0-moped-orbit.png` });
  await page.evaluate(() => { document.getElementById('start-screen').style.display = ''; });
  await page.locator('#start-btn').click({ force: true });
  await page.waitForTimeout(1500);

  const tour = [['v1-village', 70, 0], ['v2-barn', 150, 0.55], ['v3-windmill', 395, 0.75], ['v4-church', 650, -0.6], ['v5-hills', 900, 0]];
  for (const [name, z, heading] of tour) {
    await page.evaluate(([zz, h]) => window.__game.teleport(zz, h), [z, heading]);
    await page.keyboard.down('w');
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${SCREENS}/${name}.png` });
    await page.keyboard.up('w');
  }
  // up a mountain, and a look back down over the valley
  const m = await page.evaluate(() => { const G = window.__game; const z = 600; const x = G.roadX(z) + 250; return { x, z }; });
  await page.evaluate(({ x, z }) => window.__game.teleport(z, Math.PI / 2, x), m);
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__game.mopedY > 25, null, { timeout: 90000 });
  await page.screenshot({ path: `${SCREENS}/v8-mountain-climb.png` });
  await page.keyboard.up('w');
  await page.evaluate(() => window.__game.teleport(300));
  await page.evaluate(() => window.__game.forceBreakdown('engine'));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SCREENS}/v6-smoking.png` });
  for (let i = 0; i < 300 && (await page.evaluate(() => window.__game.state)) === 'broken'; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => { window.__game.maxFrustration(); window.__game.forceBreakdown('tyre'); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SCREENS}/v7-shout-face.png` });
  // the crazy content: ramp, pickups, giant duck, moose, crashed UFO, a storm
  await page.evaluate(() => { window.__game.restart(); window.__game.teleport(300); });
  const r = await page.evaluate(() => window.__game.ramps[0]);
  await page.evaluate((q) => window.__game.teleport(q.z - Math.cos(q.heading) * (q.len / 2 + 9), q.heading, q.x - Math.sin(q.heading) * (q.len / 2 + 9)), r);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENS}/v9-ramp.png` });
  const p = await page.evaluate(() => { const G = window.__game; return G.pickups.find((q) => Math.abs(q.x - G.roadX(q.z)) < 3 && q.z > 100); });
  await page.evaluate((q) => window.__game.teleport(q.z - 9, 0, q.x), p);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENS}/v10-pickups.png` });
  for (const kind of ['duck', 'moose', 'ufo']) {
    await page.evaluate((k) => {
      const G = window.__game; const l = G.landmarks.find((q) => q.kind === k);
      const z = l.z - 32; const x = G.roadX(z);
      G.teleport(z, Math.atan2(l.x - x, 32), x);
    }, kind);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SCREENS}/v11-${kind}.png` });
  }
  await page.evaluate(() => { window.__game.teleport(400); window.__game.forceRain(true); });
  await page.waitForFunction(() => window.__game.rainIntensity > 0.9, null, { timeout: 90000 });
  await page.keyboard.down('w');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SCREENS}/v12-rain.png` });
  await page.evaluate(() => window.__game.strike(false));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SCREENS}/v13-lightning.png` });
  await page.keyboard.up('w');
  expect(errors).toEqual([]);
});
