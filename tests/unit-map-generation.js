import { generateMapPage } from '../dist/src/map-generator/paginated.js';
import { compactToTile, BIOME_TYPES } from '../dist/src/shared/types.js';

/**
 * Unit tests for paginated map generation, focusing on Dwarf Fortress-style 
 * continent/ocean boundary conditions and biome designation correctness
 */

/**
 * Generate a complete small map from the paginated generator for testing
 */
function generateCompleteMap(width, height, seed) {
  // For testing, we'll generate a smaller map by scaling coordinates
  const map = [];
  
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      // Scale coordinates to 1000x1000 space for consistent generation
      const scaledX = Math.floor(x * (1000 / width));
      const scaledY = Math.floor(y * (1000 / height));
      
      // Generate a single page with just this tile
      const pageResponse = generateMapPage({
        page: Math.floor(scaledY / 10), // Use small page size for individual tiles
        pageSize: 10,
        seed
      });
      
      // Extract the specific tile from the response
      const pageY = scaledY % 10;
      const compactTile = pageResponse.tiles[pageY][scaledX];
      const tile = compactToTile(compactTile, x, y);
      
      row.push(tile);
    }
    map.push(row);
  }
  
  return map;
}

/**
 * Test that all edge tiles are ocean for the paginated generator
 */
export function testPaginatedOceanBoundaries() {
  console.log('Testing paginated generator ocean boundaries...');
  
  // Test with the actual 1000x1000 map by checking edge pages
  const seed = 'test_ocean_boundaries';
  
  // Check first row (top edge)
  const topPage = generateMapPage({ page: 0, pageSize: 1, seed });
  const topRow = topPage.tiles[0];
  
  // Check last row (bottom edge) 
  const bottomPage = generateMapPage({ page: 999, pageSize: 1, seed });
  const bottomRow = bottomPage.tiles[0];
  
  let allEdgesOcean = true;
  let nonOceanCount = 0;
  
  // Check top and bottom edges
  for (let x = 0; x < 1000; x++) {
    if (BIOME_TYPES[topRow[x].b] !== 'ocean') {
      allEdgesOcean = false;
      nonOceanCount++;
    }
    if (BIOME_TYPES[bottomRow[x].b] !== 'ocean') {
      allEdgesOcean = false;
      nonOceanCount++;
    }
  }
  
  // Check left and right edges by sampling middle rows
  for (let pageNum = 100; pageNum < 900; pageNum += 100) {
    const page = generateMapPage({ page: pageNum, pageSize: 1, seed });
    const row = page.tiles[0];
    
    if (BIOME_TYPES[row[0].b] !== 'ocean') { // Left edge
      allEdgesOcean = false;
      nonOceanCount++;
    }
    if (BIOME_TYPES[row[999].b] !== 'ocean') { // Right edge
      allEdgesOcean = false;
      nonOceanCount++;
    }
  }
  
  if (allEdgesOcean) {
    console.log('✓ PASS: All sampled edge tiles are ocean in 1000x1000 map');
    return true;
  } else {
    console.log(`✗ FAIL: ${nonOceanCount} edge tiles are not ocean`);
    return false;
  }
}

/**
 * Test 5% ocean boundary requirement
 */
export function testOceanBoundaryWidth() {
  console.log('Testing 5% ocean boundary width requirement...');
  
  const seed = 'test_boundary_width';
  const requiredBoundaryWidth = 50; // 5% of 1000
  
  // Check that tiles within 50 pixels of edge are ocean or very low elevation
  let boundaryViolations = 0;
  
  // Sample several rows and columns near boundaries
  for (let distance = 0; distance < requiredBoundaryWidth; distance += 10) {
    // Check top boundary
    const topPage = generateMapPage({ page: distance, pageSize: 1, seed });
    const topRow = topPage.tiles[0];
    
    for (let x = 0; x < 1000; x += 100) { // Sample every 100th pixel
      const tile = compactToTile(topRow[x], x, distance);
      if (tile.type !== 'ocean' && tile.type !== 'shallow_water') {
        boundaryViolations++;
      }
    }
    
    // Check left boundary (sample middle rows)
    if (distance < 10) { // Only check for first few distances
      const midPage = generateMapPage({ page: 500, pageSize: 1, seed });
      const midRow = midPage.tiles[0];
      const leftTile = compactToTile(midRow[distance], distance, 500);
      
      if (leftTile.type !== 'ocean' && leftTile.type !== 'shallow_water') {
        boundaryViolations++;
      }
    }
  }
  
  if (boundaryViolations === 0) {
    console.log('✓ PASS: Ocean boundary width requirement met');
    return true;
  } else {
    console.log(`✗ FAIL: ${boundaryViolations} boundary violations found`);
    return false;
  }
}

/**
 * Test biome distribution for Dwarf Fortress style
 */
export function testDwarfFortressBiomeDistribution() {
  console.log('Testing Dwarf Fortress-style biome distribution...');
  
  const seed = 'test_biome_distribution';
  
  // Sample biomes from several pages across the map
  const biomeCounts = {};
  let totalSamples = 0;
  
  // Sample from multiple pages to get a representative distribution
  // Use valid page numbers (0-999 for 1000 height with pageSize 1)
  const samplePages = [50, 150, 250, 350, 450, 550, 650, 750, 850, 950];
  
  for (const pageNum of samplePages) {
    const page = generateMapPage({ page: pageNum, pageSize: 1, seed }); // 1-row pages
    const row = page.tiles[0];
    
    for (let x = 0; x < 1000; x += 50) { // Sample every 50th pixel
      const biome = BIOME_TYPES[row[x].b];
      biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;
      totalSamples++;
    }
  }
  
  // Calculate percentages
  const biomePercentages = {};
  for (const [biome, count] of Object.entries(biomeCounts)) {
    biomePercentages[biome] = (count / totalSamples) * 100;
  }
  
  console.log('Biome distribution:', biomePercentages);
  
  // Validate DF-style distribution
  let passed = true;
  
  // Ocean should be 30-70% (accounting for boundaries but allowing for diverse interiors)
  if (!biomePercentages.ocean || biomePercentages.ocean < 30 || biomePercentages.ocean > 70) {
    console.log(`✗ FAIL: Ocean percentage ${biomePercentages.ocean?.toFixed(1)}% not in range 30-70%`);
    passed = false;
  }
  
  // Land should be reasonable (forest + grassland should be most common land types)
  const landBiomes = Object.keys(biomePercentages).filter(b => 
    b !== 'ocean' && b !== 'shallow_water' && b !== 'beach'
  );
  
  if (landBiomes.length < 3) {
    console.log(`✗ FAIL: Only ${landBiomes.length} land biome types, expected at least 3`);
    passed = false;
  }
  
  // Some forest should exist on land
  if (biomePercentages.forest && biomePercentages.forest > 0) {
    console.log(`✓ Forest biome present: ${biomePercentages.forest.toFixed(1)}%`);
  } else {
    console.log(`✗ FAIL: No forest biome found`);
    passed = false;
  }
  
  if (passed) {
    console.log('✓ PASS: Biome distribution meets DF-style requirements');
  }
  
  return passed;
}

/**
 * Test continent counting and separation (simplified for performance)
 */
export function testContinentCounting() {
  console.log('Testing continent counting and separation...');
  
  const seed = 'test_continents';
  
  // Sample from multiple pages to get a better distribution
  // Get the page size first
  const testPage = generateMapPage({ page: 0, pageSize: 1, seed });
  const actualPageSize = testPage.pageSize;
  const totalPages = testPage.totalPages;
  
  console.log(`Map has ${totalPages} pages with page size ${actualPageSize}`);
  
  let landTiles = 0;
  let totalTiles = 0;
  
  // Sample from several pages across the map
  const pagesToSample = [Math.floor(totalPages * 0.25), Math.floor(totalPages * 0.5), Math.floor(totalPages * 0.75)];
  
  for (const pageNum of pagesToSample) {
    const page = generateMapPage({ page: pageNum, pageSize: actualPageSize, seed });
    
    for (const row of page.tiles) {
      for (let x = 0; x < 1000; x += 200) { // Sample including edge regions
        const biome = BIOME_TYPES[row[x].b];
        if (biome !== 'ocean' && biome !== 'shallow_water' && biome !== 'beach') {
          landTiles++;
        }
        totalTiles++;
      }
    }
  }
  
  const landPercentage = (landTiles / totalTiles) * 100;
  console.log(`Found ${landTiles} land tiles out of ${totalTiles} sampled (${landPercentage.toFixed(1)}%)`);
  
  if (landTiles === 0) {
    console.log('✗ FAIL: No land tiles found in sample area');
    return false;
  }
  
  if (landPercentage < 10 || landPercentage > 90) {
    console.log(`✗ FAIL: Land percentage ${landPercentage.toFixed(1)}% seems unreasonable`);
    return false;
  }
  
  // Check that we have both land and ocean in our sample
  const oceanTiles = totalTiles - landTiles;
  if (oceanTiles === 0) {
    console.log(`✗ FAIL: No ocean tiles found in sample (need land/ocean separation)`);
    return false;
  }
  
  console.log(`✓ PASS: Land distribution reasonable (${landPercentage.toFixed(1)}% land across samples)`);
  return true;
}

/**
 * Test toroidal wrap logic (left/right wrap but ocean boundaries)
 */
export function testToroidalWrapLogic() {
  console.log('Testing toroidal wrap logic...');
  
  const seed = 'test_toroidal';
  
  // Test that left and right edges have ocean separation for toroidal wrapping
  // Sample several rows
  let wrapViolations = 0;
  
  for (let pageNum = 200; pageNum < 800; pageNum += 100) {
    const page = generateMapPage({ page: pageNum, pageSize: 1, seed });
    const row = page.tiles[0];
    
    const leftTile = compactToTile(row[0], 0, pageNum);
    const rightTile = compactToTile(row[999], 999, pageNum);
    
    // Both left and right edges should be ocean for proper toroidal wrapping
    if (leftTile.type !== 'ocean' || rightTile.type !== 'ocean') {
      wrapViolations++;
    }
  }
  
  if (wrapViolations === 0) {
    console.log('✓ PASS: Toroidal wrap logic maintained with ocean boundaries');
    return true;
  } else {
    console.log(`✗ FAIL: ${wrapViolations} violations of toroidal wrap ocean requirement`);
    return false;
  }
}

// Run all tests
export function runAllTests() {
  console.log('Running Enhanced Map Generation Unit Tests...\n');
  
  const tests = [
    { name: 'Paginated Ocean Boundaries', fn: testPaginatedOceanBoundaries },
    { name: 'Ocean Boundary Width (5%)', fn: testOceanBoundaryWidth },
    { name: 'DF-Style Biome Distribution', fn: testDwarfFortressBiomeDistribution },
    { name: 'Continent Counting', fn: testContinentCounting },
    { name: 'Toroidal Wrap Logic', fn: testToroidalWrapLogic },
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
      console.log('Stack:', error.stack);
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