import { test, expect } from '@playwright/test';

test.describe('LarsWorld Main Page', () => {
  test('should load the main page successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page title is correct
    await expect(page).toHaveTitle('LarsWorld');
    
    // Check that the main heading is visible
    await expect(page.locator('h1')).toHaveText('LarsWorld');
  });

  test('should display all required UI elements', async ({ page }) => {
    await page.goto('/');
    
    // Check for main sections
    await expect(page.locator('#map-section')).toBeVisible();
    await expect(page.locator('#map-controls')).toBeVisible();
    await expect(page.locator('#map-container')).toBeVisible();
    await expect(page.locator('#legend')).toBeVisible();
    
    // Check for generate button
    const generateButton = page.locator('#generate-map-btn');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toHaveText('Generate World');
    await expect(generateButton).toBeEnabled();
  });

  test('should display legend with all biome types', async ({ page }) => {
    await page.goto('/');
    
    const legend = page.locator('#legend');
    await expect(legend).toBeVisible();
    
    // Check legend title
    await expect(legend.locator('h3')).toHaveText('Legend');
    
    // Check for all biome types in the legend
    const expectedBiomes = [
      'Ocean',
      'Shallow Water', 
      'Beach',
      'Desert',
      'Grassland',
      'Forest',
      'Tundra',
      'Mountain',
      'Snow',
      'Swamp'
    ];
    
    for (const biome of expectedBiomes) {
      await expect(legend.locator('.legend-item').filter({ hasText: biome })).toBeVisible();
    }
  });

  test('should have proper styling and layout', async ({ page }) => {
    await page.goto('/');
    
    // Check that CSS is loaded by verifying some styled elements exist
    const legendItems = page.locator('.legend-item');
    await expect(legendItems.first()).toBeVisible();
    
    // Check that legend colors are present
    const legendColors = page.locator('.legend-color');
    const count = await legendColors.count();
    expect(count).toBeGreaterThan(0);
  });
});