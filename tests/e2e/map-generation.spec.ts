import { test, expect } from '@playwright/test';

test.describe('LarsWorld Map Generation', () => {
  test('should test small map generation with proper ocean boundaries', async ({ page }) => {
    // Test the dedicated test endpoint for small maps
    const response = await page.request.get('/api/test-map?width=50&height=50');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Should have proper dimensions
    expect(data.width).toBe(50);
    expect(data.height).toBe(50);
    
    // Should generate quickly (under 1 second for 50x50)
    expect(data.generationTime).toBeLessThan(1000);
    
    // All edges should be ocean
    expect(data.allEdgesOcean).toBe(true);
    expect(data.edgeOceanRatio).toBe(1);
    
    // Should have ocean as significant portion
    expect(data.biomeCounts.ocean).toBeGreaterThan(500); // At least 20% of 2500 tiles
    
    // Should have some land biomes
    const landBiomes = Object.keys(data.biomeCounts).filter(biome => 
      biome !== 'ocean' && biome !== 'shallow_water'
    );
    expect(landBiomes.length).toBeGreaterThan(0);
    
    console.log('Test map biome distribution:', data.biomeCounts);
  });

  test('should test boundary conditions for different small map sizes', async ({ page }) => {
    const testSizes = [
      { width: 20, height: 20 },
      { width: 30, height: 40 }, // Non-square
      { width: 10, height: 10 }, // Very small
    ];

    for (const { width, height } of testSizes) {
      const response = await page.request.get(`/api/test-map?width=${width}&height=${height}`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      
      // All edges should be ocean for any size
      expect(data.allEdgesOcean).toBe(true);
      expect(data.edgeOceanRatio).toBe(1);
      
      console.log(`${width}x${height} map: ${data.biomeCounts.ocean} ocean tiles, all edges ocean: ${data.allEdgesOcean}`);
    }
  });

  test('should handle basic UI interaction for map generation', async ({ page }) => {
    await page.goto('/');
    
    const generateButton = page.locator('#generate-paginated-btn');
    const mapContainer = page.locator('#map-container');
    
    // Initial state
    await expect(generateButton).toBeEnabled();
    await expect(generateButton).toHaveText('Generate World');
    
    // Start generation (will still be 1000x1000 from frontend, but we test the basic flow)
    await generateButton.click();
    
    // Button should be disabled during generation
    await expect(generateButton).toBeDisabled();
    await expect(generateButton).toHaveText('Generating World...');
    
    // Progress indicator should appear quickly
    await expect(page.locator('text=Generating Map with Pagination...')).toBeVisible({ timeout: 10000 });
    
    // Wait for first page to start loading (should be fast)
    await expect(page.locator('#progress-bar')).toBeVisible({ timeout: 10000 });
    
    // For faster testing, we just verify the generation starts correctly
    // Rather than waiting for the full 1000x1000 map to complete
    const progressText = page.locator('#progress-text');
    await expect(progressText).toContainText('Fetching', { timeout: 15000 });
    
    console.log('Basic UI interaction verified - generation process started correctly');
  });

  test('should validate API endpoints respond correctly', async ({ page }) => {
    // Test ping endpoint
    const pingResponse = await page.request.get('/api/ping');
    expect(pingResponse.ok()).toBeTruthy();
    const pingData = await pingResponse.json();
    expect(pingData.message).toBe('Hello World from the local server!');
    
    // Test first page of map generation
    const mapResponse = await page.request.get('/api/map?page=0&pageSize=2&seed=test');
    expect(mapResponse.ok()).toBeTruthy();
    const mapData = await mapResponse.json();
    
    // Should have expected structure
    expect(mapData.page).toBe(0);
    expect(mapData.pageSize).toBe(2);
    expect(mapData.seed).toBe('test');
    expect(mapData.tiles).toBeDefined();
    expect(Array.isArray(mapData.tiles)).toBe(true);
    
    console.log(`First page generated: ${mapData.tiles.length} rows, total pages: ${mapData.totalPages}`);
  });

  test('should validate biome assignment correctness', async ({ page }) => {
    // Test multiple small maps to ensure consistent biome assignment
    for (let i = 0; i < 3; i++) {
      const response = await page.request.get(`/api/test-map?width=30&height=30`);
      const data = await response.json();
      
      // Should always have ocean
      expect(data.biomeCounts.ocean).toBeGreaterThan(0);
      
      // Ocean should be reasonable percentage (not 100% or 0%)
      const totalTiles = 30 * 30;
      const oceanPercent = (data.biomeCounts.ocean / totalTiles) * 100;
      expect(oceanPercent).toBeGreaterThan(10); // At least 10%
      expect(oceanPercent).toBeLessThan(90);   // At most 90%
      
      // Should have some variety in biomes (at least 2 different types)
      const biomeTypes = Object.keys(data.biomeCounts);
      expect(biomeTypes.length).toBeGreaterThanOrEqual(2);
    }
  });
});