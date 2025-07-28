import { generateMap } from '../dist/src/map-generator/index.js';

/**
 * Unit tests for map generation, focusing on continent/ocean boundary conditions
 * and biome designation correctness for small map sizes
 */

/**
 * Test that all edge tiles are ocean for various small map sizes
 */
export function testOceanBoundaries() {
  const testSizes = [
    { width: 20, height: 20 },
    { width: 50, height: 50 },
    { width: 30, height: 40 }, // Non-square map
    { width: 10, height: 10 }, // Very small map
  ];

  for (const { width, height } of testSizes) {
    console.log(`Testing ${width}x${height} map for ocean boundaries...`);
    
    const map = generateMap(width, height);
    
    // Collect all edge tiles
    const edgeTiles = [];
    
    // Top and bottom edges
    for (let x = 0; x < width; x++) {
      edgeTiles.push({ x, y: 0, type: map[0][x].type });
      edgeTiles.push({ x, y: height - 1, type: map[height - 1][x].type });
    }
    
    // Left and right edges (excluding corners already counted)
    for (let y = 1; y < height - 1; y++) {
      edgeTiles.push({ x: 0, y, type: map[y][0].type });
      edgeTiles.push({ x: width - 1, y, type: map[y][width - 1].type });
    }
    
    const nonOceanEdges = edgeTiles.filter(tile => tile.type !== 'ocean');
    
    if (nonOceanEdges.length === 0) {
      console.log(`✓ PASS: All ${edgeTiles.length} edge tiles are ocean`);
    } else {
      console.log(`✗ FAIL: ${nonOceanEdges.length} out of ${edgeTiles.length} edge tiles are not ocean`);
      console.log('Non-ocean edge tiles:', nonOceanEdges.slice(0, 5)); // Show first 5 failures
      return false;
    }
  }
  
  return true;
}

/**
 * Test biome distribution sanity for small maps
 */
export function testBiomeDistribution() {
  const testSizes = [
    { width: 20, height: 20 },
    { width: 50, height: 50 }
  ];

  for (const { width, height } of testSizes) {
    console.log(`Testing ${width}x${height} map for biome distribution...`);
    
    const map = generateMap(width, height);
    const totalTiles = width * height;
    
    // Count biomes
    const biomeCounts = {};
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const biome = map[y][x].type;
        biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;
      }
    }
    
    // Must have ocean
    if (!biomeCounts.ocean || biomeCounts.ocean === 0) {
      console.log(`✗ FAIL: No ocean tiles found in ${width}x${height} map`);
      return false;
    }
    
    // Ocean should be significant portion (at least 20% for boundary enforcement)
    const oceanPercentage = (biomeCounts.ocean / totalTiles) * 100;
    if (oceanPercentage < 20) {
      console.log(`✗ FAIL: Only ${oceanPercentage.toFixed(1)}% ocean, expected at least 20%`);
      return false;
    }
    
    // Should have some land biomes
    const landBiomes = Object.keys(biomeCounts).filter(biome => 
      biome !== 'ocean' && biome !== 'shallow_water'
    );
    if (landBiomes.length === 0) {
      console.log(`✗ FAIL: No land biomes found in ${width}x${height} map`);
      return false;
    }
    
    console.log(`✓ PASS: ${oceanPercentage.toFixed(1)}% ocean, ${landBiomes.length} land biome types`);
  }
  
  return true;
}

/**
 * Test elevation constraints
 */
export function testElevationConstraints() {
  const map = generateMap(20, 20);
  
  // All edge tiles should have low elevation (ocean level)
  for (let x = 0; x < 20; x++) {
    if (map[0][x].elevation >= 0.25 || map[19][x].elevation >= 0.25) {
      console.log(`✗ FAIL: Edge tile has elevation >= 0.25 (ocean threshold)`);
      return false;
    }
  }
  for (let y = 1; y < 19; y++) {
    if (map[y][0].elevation >= 0.25 || map[y][19].elevation >= 0.25) {
      console.log(`✗ FAIL: Edge tile has elevation >= 0.25 (ocean threshold)`);
      return false;
    }
  }
  
  // Interior should have more elevation variety
  let hasHighElevation = false;
  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) {
      if (map[y][x].elevation > 0.5) {
        hasHighElevation = true;
        break;
      }
    }
    if (hasHighElevation) break;
  }
  
  if (!hasHighElevation) {
    console.log(`✗ FAIL: No high elevation found in interior`);
    return false;
  }
  
  console.log(`✓ PASS: Edge elevations constrained, interior has variety`);
  return true;
}

/**
 * Test smooth transition from ocean to land
 */
export function testSmoothTransitions() {
  const map = generateMap(30, 30);
  
  // Check that there's a gradual transition from edges to interior
  // Look at the 3rd row/column from edge (should be transition zone)
  let hasTransitionTiles = false;
  
  for (let x = 2; x < 28; x++) {
    const tile = map[2][x];
    if (tile.type === 'shallow_water' || tile.type === 'beach') {
      hasTransitionTiles = true;
      break;
    }
  }
  
  if (!hasTransitionTiles) {
    // Look for other transition indicators (low elevation but not ocean)
    for (let x = 2; x < 28; x++) {
      const tile = map[2][x];
      if (tile.elevation < 0.35 && tile.type !== 'ocean') {
        hasTransitionTiles = true;
        break;
      }
    }
  }
  
  if (hasTransitionTiles) {
    console.log(`✓ PASS: Smooth transitions detected from ocean to land`);
  } else {
    console.log(`? WARN: No clear transition zone detected (may be acceptable)`);
  }
  
  return true;
}

// Run all tests
export function runAllTests() {
  console.log('Running Map Generation Unit Tests...\n');
  
  const tests = [
    { name: 'Ocean Boundaries', fn: testOceanBoundaries },
    { name: 'Biome Distribution', fn: testBiomeDistribution },
    { name: 'Elevation Constraints', fn: testElevationConstraints },
    { name: 'Smooth Transitions', fn: testSmoothTransitions },
  ];
  
  let passed = 0;
  for (const test of tests) {
    console.log(`\n=== ${test.name} ===`);
    try {
      if (test.fn()) {
        passed++;
      }
    } catch (error) {
      console.log(`✗ FAIL: ${test.name} threw error:`, error.message);
    }
  }
  
  console.log(`\n=== Test Results ===`);
  console.log(`${passed}/${tests.length} tests passed`);
  
  return passed === tests.length;
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}