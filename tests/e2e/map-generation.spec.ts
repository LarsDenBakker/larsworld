import { test, expect } from '@playwright/test';

test.describe('LarsWorld Map Generation', () => {
  test('should generate world map successfully', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-map-btn');
    const mapContainer = page.locator('#map-container');
    
    // Initial state - button should be enabled and container empty
    await expect(generateButton).toBeEnabled();
    await expect(generateButton).toHaveText('Generate World');
    
    // Click generate button
    await generateButton.click();
    
    // Button should be disabled and text changed during generation
    await expect(generateButton).toBeDisabled();
    await expect(generateButton).toHaveText('Generating World...');
    
    // Progress indicator should appear
    await expect(page.locator('text=Generating Earthlike World...')).toBeVisible({ timeout: 10000 });
    
    // Wait for progress bar to appear
    await expect(page.locator('#progress-bar')).toBeVisible({ timeout: 10000 });
    
    // Wait for generation to complete (this might take a while)
    await expect(page.locator('text=World generation complete!')).toBeVisible({ timeout: 60000 });
    
    // Button should be re-enabled after completion
    await expect(generateButton).toBeEnabled();
    await expect(generateButton).toHaveText('Generate World');
    
    // Canvas should be present in the map container
    await expect(mapContainer.locator('canvas')).toBeVisible();
    
    // Map info should be displayed
    await expect(page.locator('text=World Size:')).toBeVisible();
  });

  test('should display progress during map generation', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-map-btn');
    
    // Start generation
    await generateButton.click();
    
    // Check for progress elements
    await expect(page.locator('text=Generating Earthlike World...')).toBeVisible({ timeout: 10000 });
    
    const progressBar = page.locator('#progress-bar');
    const progressText = page.locator('#progress-text');
    
    await expect(progressBar).toBeVisible();
    await expect(progressText).toBeVisible();
    
    // Initial progress text should indicate initialization
    await expect(progressText).toContainText('Initializing...');
    
    // Progress should eventually show chunk information
    await expect(progressText).toContainText('chunks', { timeout: 30000 });
  });

  test('should render canvas with proper dimensions', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-map-btn');
    const mapContainer = page.locator('#map-container');
    
    // Generate map
    await generateButton.click();
    
    // Wait for completion
    await expect(page.locator('text=World generation complete!')).toBeVisible({ timeout: 60000 });
    
    // Check canvas properties
    const canvas = mapContainer.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Canvas should have border styling
    const borderStyle = await canvas.evaluate((el) => getComputedStyle(el).border);
    expect(borderStyle).toContain('2px');
    
    // Canvas should have reasonable dimensions (not zero)
    const dimensions = await canvas.evaluate((el) => ({
      width: el.width,
      height: el.height
    }));
    
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
  });

  test('should handle API connection properly', async ({ page }) => {
    await page.goto('/');
    
    // Monitor network requests to the generate-map endpoint
    let hasGenerateMapRequest = false;
    
    page.on('request', (request) => {
      if (request.url().includes('/api/generate-map')) {
        hasGenerateMapRequest = true;
      }
    });
    
    // Click generate button
    await page.locator('#generate-map-btn').click();
    
    // Wait a bit for the request to be made
    await page.waitForTimeout(2000);
    
    // Verify the API call was made
    expect(hasGenerateMapRequest).toBe(true);
  });

  test('should handle multiple generations', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-map-btn');
    const mapContainer = page.locator('#map-container');
    
    // First generation
    await generateButton.click();
    await expect(page.locator('text=World generation complete!')).toBeVisible({ timeout: 60000 });
    
    // Clear the container check
    const firstCanvas = mapContainer.locator('canvas');
    await expect(firstCanvas).toBeVisible();
    
    // Second generation
    await generateButton.click();
    await expect(page.locator('text=Generating Earthlike World...')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=World generation complete!')).toBeVisible({ timeout: 60000 });
    
    // Should still have a canvas (possibly replaced)
    await expect(mapContainer.locator('canvas')).toBeVisible();
  });
});