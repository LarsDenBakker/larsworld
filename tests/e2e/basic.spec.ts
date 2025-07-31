import { test, expect } from '@playwright/test';

test.describe('LarsWorld Chunk-Based Web Application', () => {
  test('should load homepage with new chunk-based UI elements', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads with new title
    await expect(page).toHaveTitle(/LarsWorld.*Chunk-Based/);
    
    // Check that main elements are present
    await expect(page.locator('h1')).toContainText('LarsWorld');
    await expect(page.locator('.subtitle')).toContainText('Chunk-Based World Generator');
    
    // Check that coordinate inputs are present
    await expect(page.locator('input[id="min-x"]')).toBeVisible();
    await expect(page.locator('input[id="max-x"]')).toBeVisible();
    await expect(page.locator('input[id="min-y"]')).toBeVisible();
    await expect(page.locator('input[id="max-y"]')).toBeVisible();
    
    // Check that seed input is present
    await expect(page.locator('input[id="seed"]')).toBeVisible();
    
    // Check that action buttons are present
    await expect(page.locator('button[id="start-btn"]')).toBeVisible();
    await expect(page.locator('button[id="pause-btn"]')).toBeVisible();
    
    // Check that pause button is initially disabled
    await expect(page.locator('button[id="pause-btn"]')).toBeDisabled();
    
    // Check that the legend is still present
    await expect(page.locator('.legend-overlay')).toBeVisible();
    await expect(page.locator('.legend-content')).toContainText('Deep Ocean');
    await expect(page.locator('.legend-content')).toContainText('Shallow Ocean');
  });

  test('should have proper ocean colors in legend', async ({ page }) => {
    await page.goto('/');
    
    // Check that ocean colors are correctly styled
    const deepOceanElement = page.locator('.legend-item').filter({ hasText: 'Deep Ocean' }).locator('.legend-color');
    const shallowOceanElement = page.locator('.legend-item').filter({ hasText: 'Shallow Ocean' }).locator('.legend-color');
    
    // Check that the color elements have the expected colors
    await expect(deepOceanElement).toHaveCSS('background-color', 'rgb(65, 105, 225)'); // #4169e1
    await expect(shallowOceanElement).toHaveCSS('background-color', 'rgb(100, 150, 230)'); // #6496e6
  });

  test('should display legend toggle functionality', async ({ page }) => {
    // Set mobile viewport to ensure legend toggle is visible
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto('/');
    
    // Check that legend toggle button is present (should be visible on mobile)
    const legendToggle = page.locator('#legend-toggle');
    await expect(legendToggle).toBeVisible();
    
    // Check initial state (should be collapsed on mobile by default)
    const legendContent = page.locator('#legend-content');
    await expect(legendContent).toHaveClass(/collapsed/);
    
    // Test toggle functionality
    await legendToggle.click();
    
    // Check that aria-expanded attribute changes to true
    await expect(legendToggle).toHaveAttribute('aria-expanded', 'true');
    
    // Check that content is now expanded (class removed)
    await expect(legendContent).not.toHaveClass(/collapsed/);
  });

  test('should validate coordinate inputs and default values', async ({ page }) => {
    await page.goto('/');
    
    // Check default coordinate values
    await expect(page.locator('input[id="min-x"]')).toHaveValue('0');
    await expect(page.locator('input[id="max-x"]')).toHaveValue('9');
    await expect(page.locator('input[id="min-y"]')).toHaveValue('0');
    await expect(page.locator('input[id="max-y"]')).toHaveValue('9');
    
    // Test coordinate input functionality
    await page.fill('input[id="min-x"]', '1');
    await page.fill('input[id="max-x"]', '3');
    await page.fill('input[id="min-y"]', '2');
    await page.fill('input[id="max-y"]', '4');
    
    // Verify values
    await expect(page.locator('input[id="min-x"]')).toHaveValue('1');
    await expect(page.locator('input[id="max-x"]')).toHaveValue('3');
    await expect(page.locator('input[id="min-y"]')).toHaveValue('2');
    await expect(page.locator('input[id="max-y"]')).toHaveValue('4');
    
    // Test seed input functionality
    await page.fill('input[id="seed"]', 'test-chunk-world');
    await expect(page.locator('input[id="seed"]')).toHaveValue('test-chunk-world');
    
    // Clear and test placeholder
    await page.fill('input[id="seed"]', '');
    await expect(page.locator('input[id="seed"]')).toHaveAttribute('placeholder', 'Leave empty for random name');
  });

  test('should handle chunk generation with small coordinates', async ({ page }) => {
    await page.goto('/');
    
    // Set small coordinates for faster test (1×1 chunk = 1 chunk total)
    await page.fill('input[id="min-x"]', '0');
    await page.fill('input[id="max-x"]', '0');
    await page.fill('input[id="min-y"]', '0');
    await page.fill('input[id="max-y"]', '0');
    await page.fill('input[id="seed"]', 'test-seed-123');
    
    // Click start generation
    await page.click('button[id="start-btn"]');
    
    // Check that the map canvas appears
    await expect(page.locator('canvas[id="map-canvas"]')).toBeVisible({ timeout: 10000 });
    
    // Check that progress section appears during generation
    const progressSection = page.locator('#progress-section');
    
    // Wait for generation to potentially complete (single chunk should be fast)
    await page.waitForTimeout(2000);
    
    // Check that canvas has content (width and height should be set)
    const canvas = page.locator('canvas[id="map-canvas"]');
    await expect(canvas).toHaveAttribute('width');
    await expect(canvas).toHaveAttribute('height');
  });

  test('should validate coordinate constraints', async ({ page }) => {
    await page.goto('/');
    
    // Test coordinate validation by setting max < min
    await page.fill('input[id="min-x"]', '5');
    await page.fill('input[id="max-x"]', '3');
    await page.fill('input[id="min-y"]', '4');
    await page.fill('input[id="max-y"]', '2');
    
    // Try to start generation - should show error
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Max coordinates must be greater than or equal to min coordinates');
      await dialog.accept();
    });
    
    await page.click('button[id="start-btn"]');
  });

  test('should test pause/resume functionality', async ({ page }) => {
    await page.goto('/');
    
    // Set coordinates for a larger generation to ensure it takes time (3×3 chunks = 9 chunks)
    await page.fill('input[id="min-x"]', '0');
    await page.fill('input[id="max-x"]', '2');
    await page.fill('input[id="min-y"]', '0');
    await page.fill('input[id="max-y"]', '2');
    await page.fill('input[id="seed"]', 'pause-test-seed');
    
    // Start generation
    await page.click('button[id="start-btn"]');
    
    // Wait for generation to start - check if progress section appears
    await expect(page.locator('#progress-section')).toBeVisible({ timeout: 3000 });
    
    // Check that pause button becomes enabled during generation
    await expect(page.locator('button[id="pause-btn"]')).toBeEnabled({ timeout: 10000 });
    
    // Click pause
    await page.click('button[id="pause-btn"]');
    
    // Check that pause button text changes to "Resume"
    await expect(page.locator('button[id="pause-btn"] .btn-text')).toContainText('Resume');
    
    // Click resume
    await page.click('button[id="pause-btn"]');
    
    // Check that pause button text changes back to "Pause"
    await expect(page.locator('button[id="pause-btn"] .btn-text')).toContainText('Pause');
  });

  test('should generate random seed when empty', async ({ page }) => {
    await page.goto('/');
    
    // Ensure seed input is empty
    await page.fill('input[id="seed"]', '');
    
    // Set minimal coordinates for fast generation
    await page.fill('input[id="min-x"]', '0');
    await page.fill('input[id="max-x"]', '0');
    await page.fill('input[id="min-y"]', '0');
    await page.fill('input[id="max-y"]', '0');
    
    // Start generation
    await page.click('button[id="start-btn"]');
    
    // Check that a random seed was generated
    const seedValue = await page.locator('input[id="seed"]').inputValue();
    expect(seedValue).toBeTruthy();
    expect(seedValue.length).toBeGreaterThan(0);
    
    // Random seed should follow the pattern: adjective-noun-number
    expect(seedValue).toMatch(/^[a-z]+-[a-z]+-\d+$/);
  });
});