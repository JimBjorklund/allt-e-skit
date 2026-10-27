import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const SCREENS = 'test-results/screens';
fs.mkdirSync(SCREENS, { recursive: true });

const g = (page, expr) => page.evaluate(`(() => { const G = window.__game; return ${expr}; })()`);
const shot = (page, name) => page.screenshot({ path: `${SCREENS}/${name}.png` });

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // random breakdowns off so tests are deterministic; they are forced explicitly
  await page.goto('./?breakdowns=off&quality=low');
  await page.waitForFunction(() => window.__game && window.__game.ready);
  await page.waitForTimeout(500);
  await expect(page.locator('#start-screen')).toBeVisible();
  await expect(page.locator('#start-screen')).toContainText(/start/i);
  expect(await g(page, 'G.started')).toBe(false);
  await shot(page, '00-start-screen');
  await page.locator('#start-btn').click({ force: true });
  await expect(page.locator('#start-screen')).toBeHidden();
  expect(await g(page, 'G.started')).toBe(true);
});
test.afterEach(() => {
  expect(errors, 'console errors').toEqual([]);
});

test('loads, canvas is not blank, title shown', async ({ page }) => {
  await expect(page.locator('canvas#game')).toHaveCount(1);
  await expect(page.locator('#title')).toContainText('Allt e skit');
  await shot(page, '01-start');
  const png = (await page.screenshot()).toString('base64');
  const colours = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) set.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
    return set.size;
  }, png);
  expect(colours).toBeGreaterThan(8);
});

test('throttle moves the moped, brake stops it', async ({ page }) => {
  const z0 = await g(page, 'G.position.z');
  await page.keyboard.down('w');
  await page.waitForTimeout(2500);
  await shot(page, '02-riding');
  expect(await g(page, 'G.speed')).toBeGreaterThan(1);
  expect(await g(page, 'G.position.z')).toBeGreaterThan(z0 + 2);
  await page.keyboard.up('w');
  await page.keyboard.down('s');
  await page.waitForFunction(() => window.__game.speed < 0.5, null, { timeout: 30000 }); // braked to a stop
  await page.keyboard.up('s');
  expect(await g(page, 'G.speed')).toBeLessThan(0.5);
  expect(typeof (await g(page, 'G.fps'))).toBe('number');
});

test('engine breakdown: hammer space to kick-start', async ({ page }) => {
  await page.evaluate(() => window.__game.forceBreakdown('engine'));
  await expect(page.locator('#fix-panel')).toBeVisible();
  await expect(page.locator('#fix-panel')).toContainText(/space/i);
  expect(await g(page, 'G.state')).toBe('broken');
  await shot(page, '03-breakdown-engine');
  for (let i = 0; i < 300 && (await g(page, 'G.state')) === 'broken'; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(90);
  }
  expect(await g(page, 'G.state')).toBe('riding');
  await expect(page.locator('#fix-panel')).toBeHidden();
});

test('chain breakdown: press the arrows shown', async ({ page }) => {
  await page.evaluate(() => window.__game.forceBreakdown('chain'));
  await expect(page.locator('#fix-panel')).toBeVisible();
  const seq = await g(page, 'G.fixSequence');
  expect(seq.length).toBeGreaterThan(2);
  await expect(page.locator('#fix-panel .arrow')).toHaveCount(seq.length);
  await shot(page, '04-breakdown-chain');
  const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  for (const k of seq) {
    await page.keyboard.press(key[k]);
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => window.__game.state === 'riding', null, { timeout: 10000 });
});

test('tyre breakdown: hold E for 3 seconds', async ({ page }) => {
  await page.evaluate(() => window.__game.forceBreakdown('tyre'));
  await expect(page.locator('#fix-panel')).toBeVisible();
  await page.keyboard.down('e');
  await page.waitForTimeout(1000);
  expect(await g(page, 'G.state')).toBe('broken'); // 3 seconds are needed, one is not enough
  await shot(page, '05-breakdown-tyre');
  await page.waitForFunction(() => window.__game.state === 'riding', null, { timeout: 30000 });
  await page.keyboard.up('e');
  expect(await g(page, 'G.breakdowns')).toBe(1);
});

test('full frustration makes the rider shout', async ({ page }) => {
  expect(await g(page, 'G.frustration')).toBe(0);
  await page.evaluate(() => window.__game.maxFrustration());
  await page.evaluate(() => window.__game.forceBreakdown('tyre'));
  await expect(page.locator('#shout-bubble')).toBeVisible();
  expect((await page.locator('#shout-bubble').innerText()).trim().length).toBeGreaterThan(2);
  await shot(page, '06-shout');
  expect(await g(page, 'G.shouts')).toBe(1);
  expect(await g(page, 'G.frustration')).toBe(0);
});

test('reaching the finish shows the finish screen and ride again works', async ({ page }) => {
  await page.evaluate(() => window.__game.forceBreakdown('tyre'));
  await page.evaluate(() => window.__game.teleport(window.__game.length - 5));
  await page.keyboard.down('e');
  await page.waitForFunction(() => window.__game.state === 'riding', null, { timeout: 30000 });
  await page.keyboard.up('e');
  await page.keyboard.down('w');
  await expect(page.locator('#finish-screen')).toBeVisible({ timeout: 15000 });
  await page.keyboard.up('w');
  expect(await g(page, 'G.state')).toBe('finished');
  await expect(page.locator('#finish-screen')).toContainText(/time/i);
  await expect(page.locator('#finish-screen')).toContainText(/breakdowns/i);
  await expect(page.locator('#finish-screen')).toContainText(/shouts/i);
  await shot(page, '07-finish');
  await page.locator('#ride-again').click();
  await expect(page.locator('#finish-screen')).toBeHidden();
  expect(await g(page, 'G.state')).toBe('riding');
  expect(await g(page, 'G.position.z')).toBeLessThan(5);
});

test('scenery is not solid: you can ride straight through a house', async ({ page }) => {
  const house = await page.evaluate(() => window.__game.houses[3]);
  await page.evaluate(([z, x]) => window.__game.teleport(z, 0, x), [house.z - 10, house.x]);
  await page.keyboard.down('w');
  await page.waitForFunction((hz) => window.__game.position.z > hz + 6, house.z, { timeout: 40000 });
  await shot(page, '08-through-house');
  await page.keyboard.up('w');
  expect(await g(page, 'G.position.z')).toBeGreaterThan(house.z + 6);
});

test('you can go backwards: hold S from a standstill', async ({ page }) => {
  await page.evaluate(() => window.__game.teleport(100));
  await page.keyboard.down('s');
  await page.waitForFunction(() => window.__game.position.z < 98, null, { timeout: 30000 });
  expect(await g(page, 'G.speed')).toBeLessThan(0);
  await shot(page, '09-reversing');
  await page.keyboard.up('s');
  // and forwards again afterwards
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__game.speed > 2, null, { timeout: 30000 });
  await page.keyboard.up('w');
});

test('hills are solid ground: the moped rides on top of them', async ({ page }) => {
  // find a spot on a real hill and put the moped there
  const spot = await page.evaluate(() => {
    const G = window.__game;
    for (let z = 120; z < 1000; z += 20) for (const side of [1, -1]) for (let d = 40; d < 120; d += 5) {
      const x = G.roadX(z) + side * d;
      if (G.terrainY(x, z) > 5) return { x, z, y: G.terrainY(x, z) };
    }
    return null;
  });
  expect(spot, 'no hill found').not.toBeNull();
  await page.evaluate(({ x, z }) => window.__game.teleport(z, 0, x), spot);
  await page.waitForTimeout(1500);
  const y = await g(page, 'G.mopedY');
  const ground = await page.evaluate(({ x, z }) => window.__game.terrainY(x, z), await g(page, 'G.position'));
  expect(y).toBeGreaterThan(3); // up on the hill, not buried in it at ground level
  expect(Math.abs(y - ground)).toBeLessThan(0.6);
  await shot(page, '10-on-a-hill');
});

test('mountains can be climbed', async ({ page }) => {
  // ride from the foot of a mountain slope up it
  const start = await page.evaluate(() => {
    const G = window.__game;
    const z = 600, x = G.roadX(z) + 250;
    return { x, z, y: G.terrainY(x, z) };
  });
  await page.evaluate(({ x, z }) => window.__game.teleport(z, Math.PI / 2, x), start);
  await page.keyboard.down('w');
  await page.waitForFunction((y0) => window.__game.mopedY > y0 + 15, start.y, { timeout: 60000 });
  await shot(page, '11-climbing');
  await page.keyboard.up('w');
  expect(await g(page, 'G.mopedY')).toBeGreaterThan(start.y + 15);
});

test('stress: riding around at random never breaks anything', async ({ page }) => {
  test.setTimeout(120000);
  const keys = ['w', 's', 'a', 'd'];
  await page.evaluate(() => window.__game.teleport(300));
  const bad = [];
  for (let i = 0; i < 40; i++) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    const k2 = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.down(k);
    await page.keyboard.down(k2);
    await page.waitForTimeout(400);
    await page.keyboard.up(k);
    await page.keyboard.up(k2);
    const s = await page.evaluate(() => ({ p: window.__game.position, y: window.__game.mopedY, v: window.__game.speed, st: window.__game.state }));
    if (![s.p.x, s.p.z, s.y, s.v].every(Number.isFinite)) bad.push(s);
    if (s.st === 'broken') await page.evaluate(() => window.__game.teleport(window.__game.position.z));
  }
  expect(bad).toEqual([]);
  await shot(page, '12-after-stress');
});
