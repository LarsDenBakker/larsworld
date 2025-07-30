/**
 * Unit tests for world generator based strictly on specs
 * Tests only the requirements specified in specs/world-generator.md
 */
import { generateMap } from '../dist/src/map-generator/index.js';
import { generateStableSeedPngs } from './stable-seed-pngs.js';

/**
 * Test that maps are always square as required by specs
 */
function testSquareMaps() {
  try {
    // Should work for square maps
    const squareMap = generateMap(50, 50, 12345);
    if (squareMap.length !== 50 || squareMap[0].length !== 50) {
      return {
        name: 'Square Maps',
        passed: false,
        message: 'Failed to generate 50x50 square map'
      };
    }
    
    // Should throw error for non-square maps
    try {
      generateMap(50, 40, 12345);
      return {
        name: 'Square Maps',
        passed: false,
        message: 'Should throw error for non-square maps'
      };
    } catch (error) {
      // Expected behavior
    }
    
    return {
      name: 'Square Maps',
      passed: true,
      message: 'Maps are correctly enforced to be square'
    };
  } catch (error) {
    return {
      name: 'Square Maps',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test ocean coverage is 25-35% as specified
 */
function testOceanCoverage() {
  try {
    const testCases = [
      { size: 50, seed: 12345 },
      { size: 100, seed: 54321 },
      { size: 200, seed: 98765 }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      const map = generateMap(testCase.size, testCase.size, testCase.seed);
      let oceanCount = 0;
      const totalTiles = testCase.size * testCase.size;
      
      for (let y = 0; y < testCase.size; y++) {
        for (let x = 0; x < testCase.size; x++) {
          if (map[y][x].type === 'ocean') {
            oceanCount++;
          }
        }
      }
      
      const oceanPercentage = (oceanCount / totalTiles) * 100;
      const withinSpec = oceanPercentage >= 25 && oceanPercentage <= 35;
      
      results.push({
        size: testCase.size,
        seed: testCase.seed,
        oceanPercentage: oceanPercentage.toFixed(1),
        withinSpec
      });
    }
    
    const allWithinSpec = results.every(r => r.withinSpec);
    
    return {
      name: 'Ocean Coverage (25-35%)',
      passed: allWithinSpec,
      message: allWithinSpec 
        ? 'All maps have ocean coverage within 25-35% range'
        : 'Some maps have ocean coverage outside 25-35% range',
      details: results
    };
  } catch (error) {
    return {
      name: 'Ocean Coverage (25-35%)',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test that only 'land' and 'ocean' tile types exist as specified
 */
function testTileTypes() {
  try {
    const map = generateMap(100, 100, 77777);
    const allowedTypes = new Set(['land', 'ocean']);
    const foundTypes = new Set();
    
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const tileType = map[y][x].type;
        foundTypes.add(tileType);
        
        if (!allowedTypes.has(tileType)) {
          return {
            name: 'Tile Types (land/ocean only)',
            passed: false,
            message: `Found invalid tile type: ${tileType}. Only 'land' and 'ocean' are allowed per specs.`,
            details: { foundTypes: Array.from(foundTypes) }
          };
        }
      }
    }
    
    // Should have both types
    if (!foundTypes.has('land') || !foundTypes.has('ocean')) {
      return {
        name: 'Tile Types (land/ocean only)',
        passed: false,
        message: 'Map should contain both land and ocean tiles',
        details: { foundTypes: Array.from(foundTypes) }
      };
    }
    
    return {
      name: 'Tile Types (land/ocean only)',
      passed: true,
      message: 'All tiles are correctly typed as land or ocean',
      details: { foundTypes: Array.from(foundTypes) }
    };
  } catch (error) {
    return {
      name: 'Tile Types (land/ocean only)',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test deterministic generation with seeds
 */
function testDeterministicGeneration() {
  try {
    const seed = 42424;
    const size = 50;
    
    // Generate same map twice
    const map1 = generateMap(size, size, seed);
    const map2 = generateMap(size, size, seed);
    
    // Compare maps
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tile1 = map1[y][x];
        const tile2 = map2[y][x];
        
        if (tile1.type !== tile2.type || 
            Math.abs(tile1.elevation - tile2.elevation) > 0.001 ||
            Math.abs(tile1.temperature - tile2.temperature) > 0.001 ||
            Math.abs(tile1.moisture - tile2.moisture) > 0.001) {
          return {
            name: 'Deterministic Generation',
            passed: false,
            message: `Maps with same seed differ at position (${x}, ${y})`,
            details: { tile1, tile2 }
          };
        }
      }
    }
    
    // Generate with different seed to ensure they differ
    const map3 = generateMap(size, size, seed + 1);
    let foundDifference = false;
    for (let y = 0; y < size && !foundDifference; y++) {
      for (let x = 0; x < size && !foundDifference; x++) {
        if (map1[y][x].type !== map3[y][x].type) {
          foundDifference = true;
        }
      }
    }
    
    if (!foundDifference) {
      return {
        name: 'Deterministic Generation',
        passed: false,
        message: 'Maps with different seeds should differ'
      };
    }
    
    return {
      name: 'Deterministic Generation',
      passed: true,
      message: 'Same seeds produce identical maps, different seeds produce different maps'
    };
  } catch (error) {
    return {
      name: 'Deterministic Generation',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test that maps are realistic (have reasonable structure)
 */
function testMapRealism() {
  try {
    const map = generateMap(200, 200, 11111);
    
    // Check for clustering - land should be clustered, not random
    let landClusters = 0;
    let oceanClusters = 0;
    const visited = new Set();
    
    function floodFill(startX, startY, targetType) {
      const stack = [[startX, startY]];
      let size = 0;
      
      while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        
        if (visited.has(key) || x < 0 || x >= 200 || y < 0 || y >= 200) continue;
        if (map[y][x].type !== targetType) continue;
        
        visited.add(key);
        size++;
        
        // Add neighbors
        stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
      }
      
      return size;
    }
    
    // Find land clusters
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 200; x++) {
        if (!visited.has(`${x},${y}`) && map[y][x].type === 'land') {
          const clusterSize = floodFill(x, y, 'land');
          if (clusterSize > 50) { // Significant clusters only
            landClusters++;
          }
        }
      }
    }
    
    // Should have 1-3 significant land clusters (continents) as per specs
    if (landClusters < 1 || landClusters > 3) {
      return {
        name: 'Map Realism',
        passed: false,
        message: `Found ${landClusters} land clusters, specs require 1-3 continents`,
        details: { landClusters }
      };
    }
    
    return {
      name: 'Map Realism',
      passed: true,
      message: `Map has ${landClusters} land cluster(s), meeting specs for 1-3 continents`,
      details: { landClusters }
    };
  } catch (error) {
    return {
      name: 'Map Realism',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test stable seed PNG generation
 */
async function testStableSeedPngs() {
  try {
    console.log('Generating stable seed PNG images...');
    await generateStableSeedPngs();
    
    return {
      name: 'Stable Seed PNG Generation',
      passed: true,
      message: 'Successfully generated PNG images for all stable seeds'
    };
  } catch (error) {
    return {
      name: 'Stable Seed PNG Generation',
      passed: false,
      message: `Error generating stable seed PNGs: ${error.message}`
    };
  }
}

/**
 * Run all unit tests
 */
async function runAllTests() {
  console.log('Running World Generator Unit Tests (Based on Specs)...\n');
  
  const tests = [
    testSquareMaps,
    testTileTypes,
    testDeterministicGeneration,
    testOceanCoverage,
    testMapRealism,
    testStableSeedPngs
  ];
  
  const results = [];
  let passed = 0;
  
  for (const test of tests) {
    const result = await test();
    results.push(result);
    
    console.log(`${result.passed ? '✓' : '✗'} ${result.name}: ${result.message}`);
    if (result.details) {
      console.log(`  Details:`, result.details);
    }
    console.log();
    
    if (result.passed) passed++;
  }
  
  console.log(`=== Test Results ===`);
  console.log(`${passed}/${tests.length} tests passed\n`);
  
  return { passed, total: tests.length, results };
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}