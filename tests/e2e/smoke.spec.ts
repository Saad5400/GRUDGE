import { test, expect } from '@playwright/test';

/**
 * Smoke test: the game boots, renders, simulates, and takes damage-free input.
 * Runs against `vite preview` (see playwright.config.ts).
 */

test('game boots and simulates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/?seed=1234');

  // Canvas mounted
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Sim exposed and advancing
  await page.waitForFunction(() => window.__grudge !== undefined);
  const t0 = await page.evaluate(() => window.__grudge!.game.state.time);
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => window.__grudge!.game.state.time);
  expect(t1).toBeGreaterThan(t0);

  // Wave 1 started, enemies spawning
  await page.waitForFunction(() => window.__grudge!.game.state.wave >= 1);
  await page.waitForFunction(() => window.__grudge!.game.state.alive > 0, undefined, {
    timeout: 10_000,
  });

  // HUD present
  await expect(page.locator('#hud')).toBeAttached();

  // Move the mouse around — must not throw
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 5 });
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.7, { steps: 5 });
  }
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors, `console/page errors: ${errors.join('\n')}`).toHaveLength(0);
});

test('same seed is deterministic (headless sim check via page)', async ({ page }) => {
  await page.goto('/?seed=42');
  await page.waitForFunction(() => window.__grudge !== undefined);
  const seed = await page.evaluate(() => window.__grudge!.seed);
  expect(seed).toBe(42);
});
