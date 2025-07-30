import { test, expect } from '@playwright/test';

test.describe('LarsWorld Web Application', () => {
  test('should load homepage and generate a world', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/LarsWorld/);
    
    // Check that main elements are present
    await expect(page.locator('h1')).toContainText('LarsWorld');
    await expect(page.locator('#generate-paginated-btn')).toBeVisible();
    
    // Check that the legend is present with biome colors
    await expect(page.locator('.legend')).toBeVisible();
    await expect(page.locator('.legend')).toContainText('Deep Ocean');
    await expect(page.locator('.legend')).toContainText('Shallow Ocean');
    
    // Test world generation
    await page.fill('#seed-input', 'test-world');
    await page.click('#generate-paginated-btn');
    
    // Wait for generation to complete
    await expect(page.locator('#map-container canvas')).toBeVisible({ timeout: 30000 });
    
    // Check that the map is generated
    const canvas = page.locator('#map-container canvas');
    await expect(canvas).toBeVisible();
    
    // Check that the seed is displayed
    await expect(page.locator('#current-seed')).toContainText('test-world');
  });

  test('should have proper ocean colors in legend', async ({ page }) => {
    await page.goto('/');
    
    // Check that ocean colors are correctly updated
    const deepOceanElement = page.locator('.legend-item').filter({ hasText: 'Deep Ocean' }).locator('.color-swatch');
    const shallowOceanElement = page.locator('.legend-item').filter({ hasText: 'Shallow Ocean' }).locator('.color-swatch');
    
    // Check that the color swatches have the expected colors
    await expect(deepOceanElement).toHaveCSS('background-color', 'rgb(65, 105, 225)'); // #4169e1
    await expect(shallowOceanElement).toHaveCSS('background-color', 'rgb(100, 150, 230)'); // #6496e6
  });
});