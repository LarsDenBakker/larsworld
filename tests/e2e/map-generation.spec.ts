import { test, expect } from '@playwright/test';

test.describe('LarsWorld Map Generation', () => {
  test('should generate 1000x1000 world map successfully', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-paginated-btn');
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
    await expect(page.locator('text=Generating Map with Pagination...')).toBeVisible({ timeout: 10000 });
    
    // Wait for progress bar to appear
    await expect(page.locator('#progress-bar')).toBeVisible({ timeout: 10000 });
    
    // Wait for generation to complete (this might take a while for 1000x1000)
    await expect(page.locator('text=Map generated: 1000×1000 tiles')).toBeVisible({ timeout: 90000 });
    
    // Button should be re-enabled after completion
    await expect(generateButton).toBeEnabled();
    await expect(generateButton).toHaveText('Generate World');
    
    // Canvas should be present in the map container
    await expect(mapContainer.locator('canvas')).toBeVisible();
    
    // Map info should display fixed dimensions
    await expect(page.locator('text=Map generated: 1000×1000 tiles')).toBeVisible();
  });

  test('should display progress during map generation', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-paginated-btn');
    
    // Start generation
    await generateButton.click();
    
    // Check for progress elements
    await expect(page.locator('text=Generating Map with Pagination...')).toBeVisible({ timeout: 10000 });
    
    const progressBar = page.locator('#progress-bar');
    const progressText = page.locator('#progress-text');
    
    await expect(progressBar).toBeVisible();
    await expect(progressText).toBeVisible();
    
    // Initial progress text should indicate page fetching
    await expect(progressText).toContainText('Fetching page', { timeout: 10000 });
    
    // Progress should eventually show page information
    await expect(progressText).toContainText('Page', { timeout: 30000 });
  });

  test('should render canvas with proper dimensions for 1000x1000 map', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-paginated-btn');
    const mapContainer = page.locator('#map-container');
    
    // Generate map
    await generateButton.click();
    
    // Wait for completion
    await expect(page.locator('text=Map generated: 1000×1000 tiles')).toBeVisible({ timeout: 90000 });
    
    // Check canvas properties
    const canvas = mapContainer.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Canvas should have border styling
    const borderStyle = await canvas.evaluate((el) => getComputedStyle(el).border);
    expect(borderStyle).toContain('1px');
    
    // Canvas should have reasonable dimensions (not zero) and be scaled to fit display
    const dimensions = await canvas.evaluate((el) => ({
      width: el.width,
      height: el.height
    }));
    
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    // For 1000x1000 map displayed at max 800px, expect square aspect ratio
    expect(Math.abs(dimensions.width - dimensions.height)).toBeLessThan(10);
  });

  test('should handle API connection properly', async ({ page }) => {
    await page.goto('/');
    
    // Monitor network requests to the paginated map endpoint
    let hasMapRequest = false;
    
    page.on('request', (request) => {
      if (request.url().includes('/api/map')) {
        hasMapRequest = true;
      }
    });
    
    // Click generate button
    await page.locator('#generate-paginated-btn').click();
    
    // Wait a bit for the request to be made
    await page.waitForTimeout(2000);
    
    // Verify the API call was made
    expect(hasMapRequest).toBe(true);
  });

  test('should handle multiple generations', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-paginated-btn');
    const mapContainer = page.locator('#map-container');
    
    // First generation
    await generateButton.click();
    await expect(page.locator('text=Map generated: 1000×1000 tiles')).toBeVisible({ timeout: 90000 });
    
    // Clear the container check
    const firstCanvas = mapContainer.locator('canvas');
    await expect(firstCanvas).toBeVisible();
    
    // Second generation
    await generateButton.click();
    await expect(page.locator('text=Generating Map with Pagination...')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Map generated: 1000×1000 tiles')).toBeVisible({ timeout: 90000 });
    
    // Should still have a canvas (possibly replaced)
    await expect(mapContainer.locator('canvas')).toBeVisible();
  });

  test('should validate fixed map dimensions', async ({ page }) => {
    await page.goto('/');
    
    // Start generation and check for 1000x1000 in multiple places
    await page.locator('#generate-paginated-btn').click();
    
    // Should show 1000x1000 in completion message
    await expect(page.locator('text=Map generated: 1000×1000 tiles')).toBeVisible({ timeout: 90000 });
    
    // Check that no width/height inputs are present (they should be removed)
    await expect(page.locator('#width-input')).not.toBeVisible();
    await expect(page.locator('#height-input')).not.toBeVisible();
  });

  test('should generate realistic continental patterns', async ({ page }) => {
    await page.goto('/');
    
    // Generate map and wait for completion
    await page.locator('#generate-paginated-btn').click();
    await expect(page.locator('text=Map generated: 1000×1000 tiles')).toBeVisible({ timeout: 90000 });
    
    // Check that canvas is rendered with expected size
    const canvas = page.locator('#map-container canvas');
    await expect(canvas).toBeVisible();
    
    // Validate that canvas contains actual image data (not blank)
    const hasImageData = await canvas.evaluate((canvas) => {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Check if there are non-zero pixels (indicating actual map content)
      return imageData.data.some(pixel => pixel !== 0);
    });
    
    expect(hasImageData).toBe(true);
  });
});