import { test, expect } from '@playwright/test';

test.describe('LarsWorld Lit-Based Chunk UI', () => {
  test('should load homepage with Lit-based components', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads with title
    await expect(page).toHaveTitle(/LarsWorld.*Chunk-Based/);
    
    // Check that the app-main component loads and displays content
    await expect(page.locator('app-main')).toBeVisible();
    
    // Check for basic UI elements in shadow DOM
    const appMain = page.locator('app-main');
    await expect(appMain.locator('h1')).toContainText('LarsWorld');
    await expect(appMain.locator('.subtitle')).toContainText('Chunk-Based World Generator');
  });

  test('should display coordinate inputs in control panel', async ({ page }) => {
    await page.goto('/');
    
    // Wait for components to load
    await expect(page.locator('world-generator')).toBeVisible();
    
    // Check that coordinate inputs are present in the control panel
    const controlPanel = page.locator('control-panel');
    await expect(controlPanel.locator('input[name="minX"]')).toBeVisible();
    await expect(controlPanel.locator('input[name="maxX"]')).toBeVisible();
    await expect(controlPanel.locator('input[name="minY"]')).toBeVisible();
    await expect(controlPanel.locator('input[name="maxY"]')).toBeVisible();
  });

  test('should have proper default coordinate values', async ({ page }) => {
    await page.goto('/');
    
    const controlPanel = page.locator('control-panel');
    
    // Check default coordinate values
    await expect(controlPanel.locator('input[name="minX"]')).toHaveValue('0');
    await expect(controlPanel.locator('input[name="maxX"]')).toHaveValue('2');
    await expect(controlPanel.locator('input[name="minY"]')).toHaveValue('0');
    await expect(controlPanel.locator('input[name="maxY"]')).toHaveValue('2');
  });

  test('should display legend with biome information', async ({ page }) => {
    await page.goto('/');
    
    // Check that legend component is present
    const legend = page.locator('app-legend');
    await expect(legend).toBeVisible();
    
    // Check that legend contains basic biome information
    await expect(legend.locator('.legend-item')).toHaveCount(12); // 12 biomes
    await expect(legend).toContainText('Deep Ocean');
    await expect(legend).toContainText('Forest');
    await expect(legend).toContainText('Desert');
  });

  test('should display start and pause buttons', async ({ page }) => {
    await page.goto('/');
    
    const controlPanel = page.locator('control-panel');
    
    // Check that action buttons are present
    await expect(controlPanel.locator('.start-button')).toBeVisible();
    await expect(controlPanel.locator('.pause-button')).toBeVisible();
    
    // Check that start button contains expected text
    await expect(controlPanel.locator('.start-button')).toContainText('Start Generation');
    
    // Check that pause button is initially disabled
    await expect(controlPanel.locator('.pause-button')).toBeDisabled();
  });

  test('should validate coordinate input changes', async ({ page }) => {
    await page.goto('/');
    
    const controlPanel = page.locator('control-panel');
    
    // Test coordinate input functionality
    await controlPanel.locator('input[name="minX"]').fill('1');
    await controlPanel.locator('input[name="maxX"]').fill('3');
    await controlPanel.locator('input[name="minY"]').fill('2');
    await controlPanel.locator('input[name="maxY"]').fill('4');
    
    // Verify values
    await expect(controlPanel.locator('input[name="minX"]')).toHaveValue('1');
    await expect(controlPanel.locator('input[name="maxX"]')).toHaveValue('3');
    await expect(controlPanel.locator('input[name="minY"]')).toHaveValue('2');
    await expect(controlPanel.locator('input[name="maxY"]')).toHaveValue('4');
  });

  test('should handle world name input', async ({ page }) => {
    await page.goto('/');
    
    const controlPanel = page.locator('control-panel');
    
    // Test world name input
    await controlPanel.locator('input[name="worldName"]').fill('test-world-name');
    await expect(controlPanel.locator('input[name="worldName"]')).toHaveValue('test-world-name');
    
    // Check placeholder text
    await controlPanel.locator('input[name="worldName"]').fill('');
    await expect(controlPanel.locator('input[name="worldName"]')).toHaveAttribute('placeholder', 'Leave empty for random seed');
  });

  test('should display estimated size information', async ({ page }) => {
    await page.goto('/');
    
    const controlPanel = page.locator('control-panel');
    
    // Check that info section displays chunk count and size
    await expect(controlPanel.locator('.info-section')).toContainText('chunks');
    await expect(controlPanel.locator('.info-section')).toContainText('MB');
    
    // Default 3x3 should show 9 chunks
    await expect(controlPanel.locator('.info-section')).toContainText('9 chunks');
  });

  test('should show legend toggle functionality on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto('/');
    
    const legend = page.locator('app-legend');
    await expect(legend).toBeVisible();
    
    // On mobile, legend should be collapsible
    const toggleButton = legend.locator('.legend-toggle');
    await expect(toggleButton).toBeVisible();
    
    // Test toggle functionality
    await toggleButton.click();
    await page.waitForTimeout(500); // Wait for animation
    
    // Check that content visibility changes
    const content = legend.locator('.legend-content');
    await expect(content).toBeVisible();
  });
});