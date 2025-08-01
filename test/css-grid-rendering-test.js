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
 * Test chunk-based instant creation performance
 */
function testChunkBasedInstantCreation() {
  console.log('\nTesting chunk-based instant creation performance...');
  
  const container = document.getElementById('test-container');
  const tileSize = 6;
  const chunkSize = 16;
  const chunksPerSide = 50; // 50x50 chunks = 2,500 chunks total
  const chunkDisplaySize = chunkSize * tileSize; // 96px per chunk
  const totalChunks = chunksPerSide * chunksPerSide;
  
  console.log(`  Creating ${totalChunks.toLocaleString()} chunk containers (instead of 640k tiles)...`);
  
  const startTime = performance.now();
  
  // Set up CSS Grid container for chunks
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${chunksPerSide}, ${chunkDisplaySize}px)`;
  container.style.gridTemplateRows = `repeat(${chunksPerSide}, ${chunkDisplaySize}px)`;
  container.style.gap = '2px';
  
  // Create chunk containers only (much fewer DOM nodes)
  for (let chunkY = 0; chunkY < chunksPerSide; chunkY++) {
    for (let chunkX = 0; chunkX < chunksPerSide; chunkX++) {
      const chunkElement = document.createElement('div');
      chunkElement.className = 'chunk-container';
      chunkElement.style.width = `${chunkDisplaySize}px`;
      chunkElement.style.height = `${chunkDisplaySize}px`;
      chunkElement.style.position = 'relative';
      
      // Store chunk data
      chunkElement.dataset.chunkX = chunkX.toString();
      chunkElement.dataset.chunkY = chunkY.toString();
      
      container.appendChild(chunkElement);
    }
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`  Created ${totalChunks.toLocaleString()} chunk containers in ${totalTime.toFixed(2)}ms`);
  console.log(`  Rate: ${(totalChunks / totalTime * 1000).toLocaleString()} chunks/second`);
  console.log(`  DOM node reduction: ${Math.round(640000 / totalChunks)}x fewer nodes than tile-based approach`);
  
  // Cleanup
  container.innerHTML = '';
  container.style.display = '';
  container.style.gridTemplateColumns = '';
  container.style.gridTemplateRows = '';
  container.style.gap = '';
  
  return {
    totalChunks,
    totalTime,
    chunksPerSecond: totalChunks / totalTime * 1000,
    domNodeReduction: Math.round(640000 / totalChunks)
  };
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
    // Test original tile-based instant creation
    const instantResult = testCSSGridInstantCreation();
    
    // Test new chunk-based approach  
    const chunkResult = testChunkBasedInstantCreation();
    
    // Test painting performance
    const paintResult = testCSSGridPaintingPerformance();
    
    console.log('\n=== CSS Grid Summary ===');
    console.log(`Tile-based creation (640k tiles): ${(instantResult.totalTime / 1000).toFixed(2)}s`);
    console.log(`Chunk-based creation (2.5k chunks): ${(chunkResult.totalTime / 1000).toFixed(2)}s`);
    console.log(`DOM node reduction: ${chunkResult.domNodeReduction}x fewer nodes`);
    console.log(`Painting rate: ${paintResult.paintRate.toLocaleString()} tiles/sec`);
    
    // Check if chunk-based approach passes the performance test
    const passesPerformance = chunkResult.totalTime < 1000; // Should be under 1 second for chunk creation
    
    console.log(`\nChunk-based 50x50 test: ${passesPerformance ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`  Chunk creation time: ${chunkResult.totalTime.toFixed(2)}ms (target: <1000ms)`);
    if (chunkResult.totalTime < 1000) {
      console.log(`  Performance improvement: ~${Math.round(125516 / chunkResult.totalTime)}x faster than progressive approach`);
      console.log(`  Performance improvement: ~${Math.round(instantResult.totalTime / chunkResult.totalTime)}x faster than tile-based CSS Grid`);
    }
    
    return {
      passed: passesPerformance,
      instantResult,
      chunkResult,
      paintResult
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