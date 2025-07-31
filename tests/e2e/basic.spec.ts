import { test, expect } from '@playwright/test';

test.describe('LarsWorld Web Application', () => {
  test('should load homepage and basic UI elements', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/LarsWorld/);
    
    // Check that main elements are present
    await expect(page.locator('h1')).toContainText('LarsWorld');
    await expect(page.locator('#generate-paginated-btn')).toBeVisible();
    
    // Check that the legend is present with correct ID
    await expect(page.locator('#legend')).toBeVisible();
    await expect(page.locator('#legend')).toContainText('Deep Ocean');
    await expect(page.locator('#legend')).toContainText('Shallow Ocean');
    
    // Check that form controls are present and functional
    await expect(page.locator('#seed-input')).toBeVisible();
    await expect(page.locator('#pagesize-input')).toBeVisible();
    
    // Test that we can type in the seed input
    await page.fill('#seed-input', '12345');
    await expect(page.locator('#seed-input')).toHaveValue('12345');
    
    // Test that we can change the page size
    await page.selectOption('#pagesize-input', '32');
    await expect(page.locator('#pagesize-input')).toHaveValue('32');
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
    
    // Check that content is now expanded
    await expect(legendContent).toHaveClass(/expanded/);
  });

  test('should validate form inputs and UI responsiveness', async ({ page }) => {
    await page.goto('/');
    
    // Test seed input functionality
    await page.fill('#seed-input', 'test-world-name');
    await expect(page.locator('#seed-input')).toHaveValue('test-world-name');
    
    // Clear and test placeholder
    await page.fill('#seed-input', '');
    await expect(page.locator('#seed-input')).toHaveAttribute('placeholder', 'Leave empty for random name');
    
    // Test pagesize dropdown options
    const pagesizeSelect = page.locator('#pagesize-input');
    await expect(pagesizeSelect).toBeVisible();
    
    // Test all available options
    await page.selectOption('#pagesize-input', '32');
    await expect(pagesizeSelect).toHaveValue('32');
    
    await page.selectOption('#pagesize-input', '64');
    await expect(pagesizeSelect).toHaveValue('64');
    
    await page.selectOption('#pagesize-input', '128');
    await expect(pagesizeSelect).toHaveValue('128');
    
    await page.selectOption('#pagesize-input', '256');
    await expect(pagesizeSelect).toHaveValue('256');
    
    // Test that generate button is clickable
    const generateBtn = page.locator('#generate-paginated-btn');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeEnabled();
  });
});