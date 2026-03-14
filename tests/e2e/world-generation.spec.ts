import { test, expect } from '@playwright/test';

test.describe('World Generation UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with all required components visible', async ({ page }) => {
    await expect(page.locator('app-main')).toBeVisible();
    await expect(page.locator('world-generator')).toBeVisible();
    await expect(page.locator('control-panel')).toBeVisible();
    await expect(page.locator('world-map')).toBeVisible();
    await expect(page.locator('app-legend')).toBeVisible();
  });

  test('start button triggers generation and status updates', async ({ page }) => {
    const controlPanel = page.locator('control-panel');

    // Use a tiny 2x2 area for speed
    await controlPanel.locator('input[name="minX"]').fill('0');
    await controlPanel.locator('input[name="maxX"]').fill('1');
    await controlPanel.locator('input[name="minY"]').fill('0');
    await controlPanel.locator('input[name="maxY"]').fill('1');

    await controlPanel.locator('.start-button').click();

    // Status message should appear
    await expect(controlPanel.locator('.status-message')).toBeVisible({ timeout: 5000 });
  });

  test('small world generates completely and renders canvas', async ({ page }) => {
    const controlPanel = page.locator('control-panel');

    // 3x3 chunk area = 9 chunks
    await controlPanel.locator('input[name="maxX"]').fill('2');
    await controlPanel.locator('input[name="maxY"]').fill('2');
    await controlPanel.locator('.start-button').click();

    // Wait for completion
    await expect(controlPanel.locator('.status-message')).toContainText('Generation complete', {
      timeout: 30000
    });

    // Canvas should be visible with content
    const canvas = page.locator('world-map canvas');
    await expect(canvas).toBeVisible();

    // Verify canvas has non-zero dimensions
    const dims = await canvas.evaluate((el: HTMLCanvasElement) => ({
      w: el.width,
      h: el.height
    }));
    expect(dims.w).toBeGreaterThan(0);
    expect(dims.h).toBeGreaterThan(0);
  });

  test('canvas dimensions match requested chunk area', async ({ page }) => {
    const controlPanel = page.locator('control-panel');
    await controlPanel.locator('input[name="maxX"]').fill('4');
    await controlPanel.locator('input[name="maxY"]').fill('2');
    await controlPanel.locator('.start-button').click();

    await expect(controlPanel.locator('.status-message')).toContainText('Generation complete', {
      timeout: 30000
    });

    const dims = await page.evaluate(() => {
      const worldMap = (document.querySelector('app-main') as any)
        ?.shadowRoot?.querySelector('world-generator')
        ?.shadowRoot?.querySelector('world-map')
        ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
      return worldMap ? { w: worldMap.width, h: worldMap.height } : null;
    });

    // 5 chunks wide × 16 tiles × 4px = 320; 3 chunks tall = 192
    expect(dims?.w).toBe(5 * 16 * 4);
    expect(dims?.h).toBe(3 * 16 * 4);
  });

  test('world renders non-uniform pixel colors (not a blank screen)', async ({ page }) => {
    const controlPanel = page.locator('control-panel');

    // Use coords verified to have mixed ocean/forest biomes with seed 12345
    await controlPanel.locator('input[name="minX"]').fill('0');
    await controlPanel.locator('input[name="maxX"]').fill('3');
    await controlPanel.locator('input[name="minY"]').fill('28');
    await controlPanel.locator('input[name="maxY"]').fill('31');
    await controlPanel.locator('input[name="worldName"]').fill('12345');

    await controlPanel.locator('.start-button').click();
    await expect(controlPanel.locator('.status-message')).toContainText('Generation complete', {
      timeout: 30000
    });

    // Sample pixels across the canvas and verify they're not all the same color
    const colors = await page.evaluate(() => {
      const worldMap = (document.querySelector('app-main') as any)
        ?.shadowRoot?.querySelector('world-generator')
        ?.shadowRoot?.querySelector('world-map')
        ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
      if (!worldMap) return null;
      const ctx = worldMap.getContext('2d')!;
      const samples: string[] = [];
      for (let i = 0; i < 10; i++) {
        const x = Math.floor((worldMap.width / 10) * i);
        const y = Math.floor(worldMap.height / 2);
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        samples.push(`${r},${g},${b}`);
      }
      return samples;
    });

    expect(colors).not.toBeNull();
    const uniqueColors = new Set(colors!);
    expect(uniqueColors.size).toBeGreaterThan(1);
  });

  test('world name seed produces same map on re-generation', async ({ page }) => {
    const controlPanel = page.locator('control-panel');
    await controlPanel.locator('input[name="maxX"]').fill('2');
    await controlPanel.locator('input[name="maxY"]').fill('2');
    await controlPanel.locator('input[name="worldName"]').fill('my-deterministic-seed');

    await controlPanel.locator('.start-button').click();
    await expect(controlPanel.locator('.status-message')).toContainText('Generation complete', {
      timeout: 30000
    });

    const getCanvasData = () =>
      page.evaluate(() => {
        const canvas = (document.querySelector('app-main') as any)
          ?.shadowRoot?.querySelector('world-generator')
          ?.shadowRoot?.querySelector('world-map')
          ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) return null;
        const ctx = canvas.getContext('2d')!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // Return a small fingerprint — sum of first 1000 pixel values
        let sum = 0;
        for (let i = 0; i < Math.min(1000, data.length); i++) sum += data[i];
        return sum;
      });

    const firstRun = await getCanvasData();

    // Re-generate with same seed
    await controlPanel.locator('.start-button').click();
    await expect(controlPanel.locator('.status-message')).toContainText('Generation complete', {
      timeout: 30000
    });

    const secondRun = await getCanvasData();
    expect(firstRun).toBe(secondRun);
  });

  test('pause button becomes enabled during generation', async ({ page }) => {
    const controlPanel = page.locator('control-panel');

    // Use a slightly larger area so generation takes longer
    await controlPanel.locator('input[name="maxX"]').fill('5');
    await controlPanel.locator('input[name="maxY"]').fill('5');

    await controlPanel.locator('.start-button').click();

    // Pause button should enable once generation starts
    await expect(controlPanel.locator('.pause-button')).toBeEnabled({ timeout: 10000 });
  });

  test('pause and resume generation', async ({ page }) => {
    const controlPanel = page.locator('control-panel');
    await controlPanel.locator('input[name="maxX"]').fill('5');
    await controlPanel.locator('input[name="maxY"]').fill('5');

    await controlPanel.locator('.start-button').click();
    await expect(controlPanel.locator('.pause-button')).toBeEnabled({ timeout: 10000 });

    // Pause
    await controlPanel.locator('.pause-button').click();
    await expect(controlPanel.locator('.status-message')).toContainText('paused', {
      timeout: 5000,
      ignoreCase: true
    });

    // Resume
    await controlPanel.locator('.pause-button').click();
    await expect(controlPanel.locator('.status-message')).not.toContainText('paused', {
      timeout: 5000,
      ignoreCase: true
    });
  });

  test('invalid range (max < min) disables start button', async ({ page }) => {
    const controlPanel = page.locator('control-panel');
    await controlPanel.locator('input[name="minX"]').fill('10');
    await controlPanel.locator('input[name="maxX"]').fill('5');

    await expect(controlPanel.locator('.start-button')).toBeDisabled();
  });

  test('world map shows placeholder before generation', async ({ page }) => {
    const worldMap = page.locator('world-map');
    await expect(worldMap).toContainText('Start Generation');
    await expect(worldMap.locator('canvas')).not.toBeVisible();
  });

  test('chunk count updates when coordinates change', async ({ page }) => {
    const controlPanel = page.locator('control-panel');

    await controlPanel.locator('input[name="minX"]').fill('0');
    await controlPanel.locator('input[name="maxX"]').fill('4');
    await controlPanel.locator('input[name="minY"]').fill('0');
    await controlPanel.locator('input[name="maxY"]').fill('4');

    // 5×5 = 25 chunks
    await expect(controlPanel.locator('.info-section')).toContainText('25 chunks');
  });

  test('re-generation clears previous map and redraws', async ({ page }) => {
    const controlPanel = page.locator('control-panel');
    await controlPanel.locator('input[name="maxX"]').fill('1');
    await controlPanel.locator('input[name="maxY"]').fill('1');
    await controlPanel.locator('input[name="worldName"]').fill('seed-a');

    // First generation
    await controlPanel.locator('.start-button').click();
    await expect(controlPanel.locator('.status-message')).toContainText('Generation complete', {
      timeout: 30000
    });

    const first = await page.evaluate(() => {
      const canvas = (document.querySelector('app-main') as any)
        ?.shadowRoot?.querySelector('world-generator')
        ?.shadowRoot?.querySelector('world-map')
        ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
      return canvas?.getContext('2d')?.getImageData(0, 0, 16, 16).data.toString();
    });

    // Change seed and regenerate
    await controlPanel.locator('input[name="worldName"]').fill('seed-b');
    await controlPanel.locator('.start-button').click();
    await expect(controlPanel.locator('.status-message')).toContainText('Generation complete', {
      timeout: 30000
    });

    const second = await page.evaluate(() => {
      const canvas = (document.querySelector('app-main') as any)
        ?.shadowRoot?.querySelector('world-generator')
        ?.shadowRoot?.querySelector('world-map')
        ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
      return canvas?.getContext('2d')?.getImageData(0, 0, 16, 16).data.toString();
    });

    // Different seeds should produce different pixel data
    expect(first).not.toBe(second);
  });

  test('loaded chunk count reaches total on completion', async ({ page }) => {
    const controlPanel = page.locator('control-panel');
    await controlPanel.locator('input[name="maxX"]').fill('2');
    await controlPanel.locator('input[name="maxY"]').fill('2');
    await controlPanel.locator('.start-button').click();

    await expect(controlPanel.locator('.status-message')).toContainText('9 chunks', {
      timeout: 30000
    });
  });
});
