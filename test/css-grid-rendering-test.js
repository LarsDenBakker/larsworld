/**
 * CSS Grid rendering performance tests - tests instant grid creation
 */
import { JSDOM } from 'jsdom';

// Setup DOM environment for testing
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="test-container"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;

/**
 * Test CSS Grid instant tile creation performance
 */
function testCSSGridInstantCreation() {
  console.log('Testing CSS Grid instant creation performance...');
  
  const container = document.getElementById('test-container');
  const tileSize = 6;
  const chunksPerSide = 50; // 50x50 chunks = 640,000 tiles
  const chunkSize = 16;
  const totalCols = chunksPerSide * chunkSize;
  const totalRows = chunksPerSide * chunkSize;
  const totalTiles = totalCols * totalRows;
  
  console.log(`  Creating ${totalTiles.toLocaleString()} tiles with CSS Grid...`);
  
  const startTime = performance.now();
  
  // Set up CSS Grid container (this replaces the progressive creation)
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${totalCols}, ${tileSize}px)`;
  container.style.gridTemplateRows = `repeat(${totalRows}, ${tileSize}px)`;
  container.style.gap = '1px';
  
  // Create all tiles at once (synchronous, but lightweight)
  for (let globalY = 0; globalY < totalRows; globalY++) {
    for (let globalX = 0; globalX < totalCols; globalX++) {
      const tileElement = document.createElement('div');
      tileElement.className = 'world-tile';
      // No background color initially - invisible placeholder
      
      // Store minimal data
      tileElement.dataset.tileX = globalX.toString();
      tileElement.dataset.tileY = globalY.toString();
      
      container.appendChild(tileElement);
    }
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`  Created ${totalTiles.toLocaleString()} tiles in ${totalTime.toFixed(2)}ms`);
  console.log(`  Rate: ${(totalTiles / totalTime * 1000).toLocaleString()} tiles/second`);
  
  // Cleanup
  container.innerHTML = '';
  container.style.display = '';
  container.style.gridTemplateColumns = '';
  container.style.gridTemplateRows = '';
  container.style.gap = '';
  
  return {
    totalTiles,
    totalTime,
    tilesPerSecond: totalTiles / totalTime * 1000
  };
}

/**
 * Test painting performance on existing grid
 */
function testCSSGridPaintingPerformance() {
  console.log('\nTesting CSS Grid painting performance...');
  
  const container = document.getElementById('test-container');
  const tileSize = 6;
  const chunksPerSide = 10; // 10x10 chunks = 25,600 tiles (more manageable for painting test)
  const chunkSize = 16;
  const totalCols = chunksPerSide * chunkSize;
  const totalRows = chunksPerSide * chunkSize;
  const totalTiles = totalCols * totalRows;
  
  // First create the grid
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${totalCols}, ${tileSize}px)`;
  container.style.gridTemplateRows = `repeat(${totalRows}, ${tileSize}px)`;
  container.style.gap = '1px';
  
  const tiles = [];
  for (let globalY = 0; globalY < totalRows; globalY++) {
    for (let globalX = 0; globalX < totalCols; globalX++) {
      const tileElement = document.createElement('div');
      tileElement.className = 'world-tile';
      tileElement.dataset.tileX = globalX.toString();
      tileElement.dataset.tileY = globalY.toString();
      
      container.appendChild(tileElement);
      tiles.push(tileElement);
    }
  }
  
  console.log(`  Grid created with ${totalTiles.toLocaleString()} tiles`);
  console.log(`  Now testing painting performance...`);
  
  // Test painting all tiles
  const startTime = performance.now();
  
  // Simulate painting with different biome colors
  const colors = ['#4169e1', '#6496e6', '#228b22', '#7cfc00', '#eecbad', '#bdb76b'];
  
  tiles.forEach((tile, index) => {
    const color = colors[index % colors.length];
    tile.style.backgroundColor = color;
    tile.classList.add('painted');
  });
  
  const endTime = performance.now();
  const paintTime = endTime - startTime;
  
  console.log(`  Painted ${totalTiles.toLocaleString()} tiles in ${paintTime.toFixed(2)}ms`);
  console.log(`  Paint rate: ${(totalTiles / paintTime * 1000).toLocaleString()} tiles/second`);
  
  // Cleanup
  container.innerHTML = '';
  container.style.display = '';
  container.style.gridTemplateColumns = '';
  container.style.gridTemplateRows = '';
  container.style.gap = '';
  
  return {
    totalTiles,
    paintTime,
    paintRate: totalTiles / paintTime * 1000
  };
}

/**
 * Compare old vs new approach
 */
function compareApproaches() {
  console.log('\n=== Comparing Approaches ===');
  
  // Test different sizes
  const testSizes = [
    { chunks: 10, description: '10x10 chunks (25,600 tiles)' },
    { chunks: 25, description: '25x25 chunks (160,000 tiles)' },
    { chunks: 50, description: '50x50 chunks (640,000 tiles)' }
  ];
  
  const results = [];
  
  testSizes.forEach(testSize => {
    console.log(`\nTesting ${testSize.description}:`);
    
    const result = testCSSGridInstantCreationWithSize(testSize.chunks);
    results.push({
      ...testSize,
      ...result
    });
  });
  
  return results;
}

/**
 * Test CSS Grid creation with specific size
 */
function testCSSGridInstantCreationWithSize(chunksPerSide) {
  const container = document.getElementById('test-container');
  const tileSize = 6;
  const chunkSize = 16;
  const totalCols = chunksPerSide * chunkSize;
  const totalRows = chunksPerSide * chunkSize;
  const totalTiles = totalCols * totalRows;
  
  const startTime = performance.now();
  
  // Set up CSS Grid
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${totalCols}, ${tileSize}px)`;
  container.style.gridTemplateRows = `repeat(${totalRows}, ${tileSize}px)`;
  container.style.gap = '1px';
  
  // Create all tiles instantly
  for (let i = 0; i < totalTiles; i++) {
    const tileElement = document.createElement('div');
    tileElement.className = 'world-tile';
    container.appendChild(tileElement);
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`  CSS Grid: ${totalTime.toFixed(2)}ms (${(totalTiles / totalTime * 1000).toLocaleString()} tiles/sec)`);
  
  // Cleanup
  container.innerHTML = '';
  container.style.display = '';
  container.style.gridTemplateColumns = '';
  container.style.gridTemplateRows = '';
  container.style.gap = '';
  
  return {
    totalTime,
    tilesPerSecond: totalTiles / totalTime * 1000,
    totalTiles
  };
}

/**
 * Run all CSS Grid rendering tests
 */
async function runCSSGridRenderingTests() {
  console.log('=== CSS Grid Rendering Performance Tests ===\n');
  
  try {
    // Test instant creation
    const instantResult = testCSSGridInstantCreation();
    
    // Test painting performance
    const paintResult = testCSSGridPaintingPerformance();
    
    // Compare different sizes
    const comparisonResults = compareApproaches();
    
    console.log('\n=== CSS Grid Summary ===');
    console.log(`Instant creation (640k tiles): ${(instantResult.totalTime / 1000).toFixed(2)}s`);
    console.log(`Creation rate: ${instantResult.tilesPerSecond.toLocaleString()} tiles/sec`);
    console.log(`Painting rate: ${paintResult.paintRate.toLocaleString()} tiles/sec`);
    
    console.log('\nSize comparison:');
    comparisonResults.forEach(result => {
      console.log(`  ${result.description}: ${result.totalTime.toFixed(2)}ms`);
    });
    
    // Check if 50x50 passes the performance test (should be under 5 seconds)
    const large50x50 = comparisonResults.find(r => r.chunks === 50);
    const passes50x50 = large50x50 && large50x50.totalTime < 5000;
    
    console.log(`\n50x50 chunks test: ${passes50x50 ? '✓ PASSED' : '✗ FAILED'}`);
    if (large50x50) {
      console.log(`  Time: ${(large50x50.totalTime / 1000).toFixed(2)}s (target: <5s)`);
      console.log(`  Improvement: ~${Math.round(125516 / large50x50.totalTime)}x faster than progressive approach`);
    }
    
    return {
      passed: passes50x50,
      instantResult,
      paintResult,
      comparisonResults
    };
    
  } catch (error) {
    console.error('CSS Grid rendering test failed:', error);
    return {
      passed: false,
      error: error.message
    };
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCSSGridRenderingTests().catch(console.error);
}

export { runCSSGridRenderingTests };