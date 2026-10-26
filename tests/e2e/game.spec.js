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
  await page.goto('./?breakdowns=off');
  await page.waitForFunction(() => window.__game && window.__game.ready);
  await page.waitForTimeout(500);
  await expect(page.locator('#start-screen')).toBeVisible();
  await expect(page.locator('#start-screen')).toContainText(/start/i);
  expect(await g(page, 'G.started')).toBe(false);
  await shot(page, '00-start-screen');
  await page.locator('#start-btn').click();
  await expect(page.locator('#start-screen')).toBeHidden();
  expect(await g(page, 'G.started')).toBe(true);
});
test.afterEach(() => {
  expect(errors, 'console errors').toEqual([]);
});

test('loads, canvas is not blank, title shown', async ({ page }) => {
  await expect(page.locator('canvas')).toHaveCount(1);
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
  await page.waitForTimeout(3500);
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
    await page.waitForTimeout(60);
  }
  expect(await g(page, 'G.state')).toBe('riding');
});

test('tyre breakdown: hold E for 3 seconds', async ({ page }) => {
  await page.evaluate(() => window.__game.forceBreakdown('tyre'));
  await expect(page.locator('#fix-panel')).toBeVisible();
  await page.keyboard.down('e');
  await page.waitForTimeout(1500);
  expect(await g(page, 'G.state')).toBe('broken');
  await shot(page, '05-breakdown-tyre');
  await page.waitForTimeout(2000);
  await page.keyboard.up('e');
  expect(await g(page, 'G.state')).toBe('riding');
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
  await page.waitForTimeout(3300);
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
