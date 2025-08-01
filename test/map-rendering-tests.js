/**
 * Map rendering performance tests - tests DOM creation without data fetching
 */
import { JSDOM } from 'jsdom';

// Setup DOM environment for testing
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="test-container"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = (callback) => setTimeout(callback, 16); // 60fps simulation

/**
 * Test basic tile creation performance
 */
function testBasicTileCreation() {
  console.log('Testing basic tile creation performance...');
  
  const container = document.getElementById('test-container');
  const tileSize = 6;
  const tilesPerSide = 100; // 10,000 tiles total
  
  const startTime = performance.now();
  
  // Create tiles synchronously (this is what's causing the freeze)
  for (let y = 0; y < tilesPerSide; y++) {
    for (let x = 0; x < tilesPerSide; x++) {
      const tileElement = document.createElement('div');
      tileElement.className = 'world-tile placeholder';
      tileElement.style.position = 'absolute';
      tileElement.style.left = `${x * tileSize}px`;
      tileElement.style.top = `${y * tileSize}px`;
      tileElement.style.width = `${tileSize}px`;
      tileElement.style.height = `${tileSize}px`;
      tileElement.style.backgroundColor = '#e5e7eb';
      
      container.appendChild(tileElement);
    }
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const totalTiles = tilesPerSide * tilesPerSide;
  
  console.log(`  Created ${totalTiles.toLocaleString()} tiles in ${totalTime.toFixed(2)}ms`);
  console.log(`  Rate: ${(totalTiles / totalTime * 1000).toLocaleString()} tiles/second`);
  
  // Cleanup
  container.innerHTML = '';
  
  return {
    totalTiles,
    totalTime,
    tilesPerSecond: totalTiles / totalTime * 1000
  };
}

/**
 * Test progressive tile creation (non-blocking)
 */
async function testProgressiveTileCreation() {
  console.log('\nTesting progressive tile creation performance...');
  
  const container = document.getElementById('test-container');
  const tileSize = 6;
  const tilesPerSide = 100; // 10,000 tiles total
  const batchSize = 100; // Create 100 tiles per frame
  const totalTiles = tilesPerSide * tilesPerSide;
  
  const startTime = performance.now();
  let tilesCreated = 0;
  
  return new Promise((resolve) => {
    function createBatch() {
      const batchStart = performance.now();
      let batchCount = 0;
      
      // Create tiles up to batch size or until done
      while (batchCount < batchSize && tilesCreated < totalTiles) {
        const x = tilesCreated % tilesPerSide;
        const y = Math.floor(tilesCreated / tilesPerSide);
        
        const tileElement = document.createElement('div');
        tileElement.className = 'world-tile placeholder';
        tileElement.style.position = 'absolute';
        tileElement.style.left = `${x * tileSize}px`;
        tileElement.style.top = `${y * tileSize}px`;
        tileElement.style.width = `${tileSize}px`;
        tileElement.style.height = `${tileSize}px`;
        tileElement.style.backgroundColor = '#e5e7eb';
        
        container.appendChild(tileElement);
        
        tilesCreated++;
        batchCount++;
      }
      
      const batchTime = performance.now() - batchStart;
      
      if (tilesCreated < totalTiles) {
        // Continue with next batch
        requestAnimationFrame(createBatch);
      } else {
        // Done
        const totalTime = performance.now() - startTime;
        console.log(`  Created ${totalTiles.toLocaleString()} tiles progressively in ${totalTime.toFixed(2)}ms`);
        console.log(`  Rate: ${(totalTiles / totalTime * 1000).toLocaleString()} tiles/second`);
        console.log(`  Used ${Math.ceil(totalTiles / batchSize)} batches of ${batchSize} tiles each`);
        
        // Cleanup
        container.innerHTML = '';
        
        resolve({
          totalTiles,
          totalTime,
          tilesPerSecond: totalTiles / totalTime * 1000,
          batches: Math.ceil(totalTiles / batchSize)
        });
      }
    }
    
    createBatch();
  });
}

/**
 * Test scaling performance with different map sizes
 */
async function testScalingPerformance() {
  console.log('\nTesting scaling performance with different map sizes...');
  
  const chunkSize = 16;
  const tileSize = 6;
  
  // Test different chunk grid sizes
  const testSizes = [
    { chunks: 3, description: '3x3 chunks' },      // 9 chunks = 2,304 tiles
    { chunks: 10, description: '10x10 chunks' },   // 100 chunks = 25,600 tiles  
    { chunks: 25, description: '25x25 chunks' },   // 625 chunks = 160,000 tiles
    { chunks: 50, description: '50x50 chunks' }    // 2,500 chunks = 640,000 tiles
  ];
  
  const results = [];
  
  for (const testSize of testSizes) {
    const chunksPerSide = testSize.chunks;
    const totalChunks = chunksPerSide * chunksPerSide;
    const totalTiles = totalChunks * chunkSize * chunkSize;
    
    console.log(`\n  Testing ${testSize.description} (${totalTiles.toLocaleString()} tiles):`);
    
    if (totalTiles > 100000) {
      // Use progressive creation for large maps
      const result = await testProgressiveTileCreationWithSize(chunksPerSide, chunkSize, tileSize);
      results.push({
        ...testSize,
        totalTiles,
        ...result,
        method: 'progressive'
      });
    } else {
      // Use synchronous creation for small maps
      const result = testSynchronousTileCreationWithSize(chunksPerSide, chunkSize, tileSize);
      results.push({
        ...testSize,
        totalTiles,
        ...result,
        method: 'synchronous'
      });
    }
  }
  
  return results;
}

/**
 * Test synchronous tile creation with specific size
 */
function testSynchronousTileCreationWithSize(chunksPerSide, chunkSize, tileSize) {
  const container = document.getElementById('test-container');
  const totalTiles = chunksPerSide * chunksPerSide * chunkSize * chunkSize;
  
  const startTime = performance.now();
  
  // Create tiles for all chunks
  for (let chunkY = 0; chunkY < chunksPerSide; chunkY++) {
    for (let chunkX = 0; chunkX < chunksPerSide; chunkX++) {
      for (let localY = 0; localY < chunkSize; localY++) {
        for (let localX = 0; localX < chunkSize; localX++) {
          const globalX = chunkX * chunkSize + localX;
          const globalY = chunkY * chunkSize + localY;
          
          const tileElement = document.createElement('div');
          tileElement.className = 'world-tile placeholder';
          tileElement.style.position = 'absolute';
          tileElement.style.left = `${globalX * tileSize}px`;
          tileElement.style.top = `${globalY * tileSize}px`;
          tileElement.style.width = `${tileSize}px`;
          tileElement.style.height = `${tileSize}px`;
          tileElement.style.backgroundColor = '#e5e7eb';
          
          container.appendChild(tileElement);
        }
      }
    }
  }
  
  const totalTime = performance.now() - startTime;
  
  console.log(`    Synchronous: ${totalTime.toFixed(2)}ms (${(totalTiles / totalTime * 1000).toLocaleString()} tiles/sec)`);
  
  // Cleanup
  container.innerHTML = '';
  
  return {
    totalTime,
    tilesPerSecond: totalTiles / totalTime * 1000
  };
}

/**
 * Test progressive tile creation with specific size
 */
async function testProgressiveTileCreationWithSize(chunksPerSide, chunkSize, tileSize) {
  const container = document.getElementById('test-container');
  const totalTiles = chunksPerSide * chunksPerSide * chunkSize * chunkSize;
  const batchSize = 100; // Create 100 tiles per frame
  
  const startTime = performance.now();
  let tilesCreated = 0;
  
  return new Promise((resolve) => {
    function createBatch() {
      const batchStart = performance.now();
      let batchCount = 0;
      
      // Create tiles up to batch size or until done
      while (batchCount < batchSize && tilesCreated < totalTiles) {
        // Calculate chunk and local coordinates from tile index
        const tilesPerChunk = chunkSize * chunkSize;
        const tilesPerChunkRow = chunksPerSide * chunkSize;
        
        const globalY = Math.floor(tilesCreated / tilesPerChunkRow);
        const globalX = tilesCreated % tilesPerChunkRow;
        
        const tileElement = document.createElement('div');
        tileElement.className = 'world-tile placeholder';
        tileElement.style.position = 'absolute';
        tileElement.style.left = `${globalX * tileSize}px`;
        tileElement.style.top = `${globalY * tileSize}px`;
        tileElement.style.width = `${tileSize}px`;
        tileElement.style.height = `${tileSize}px`;
        tileElement.style.backgroundColor = '#e5e7eb';
        
        container.appendChild(tileElement);
        
        tilesCreated++;
        batchCount++;
      }
      
      const batchTime = performance.now() - batchStart;
      const progress = (tilesCreated / totalTiles * 100).toFixed(1);
      
      if (tilesCreated < totalTiles) {
        // Continue with next batch
        if (tilesCreated % 10000 === 0) { // Log progress every 10k tiles
          console.log(`    Progress: ${progress}% (${tilesCreated.toLocaleString()}/${totalTiles.toLocaleString()} tiles)`);
        }
        requestAnimationFrame(createBatch);
      } else {
        // Done
        const totalTime = performance.now() - startTime;
        console.log(`    Progressive: ${totalTime.toFixed(2)}ms (${(totalTiles / totalTime * 1000).toLocaleString()} tiles/sec)`);
        console.log(`    Used ${Math.ceil(totalTiles / batchSize)} batches of ${batchSize} tiles each`);
        
        // Cleanup
        container.innerHTML = '';
        
        resolve({
          totalTime,
          tilesPerSecond: totalTiles / totalTime * 1000,
          batches: Math.ceil(totalTiles / batchSize)
        });
      }
    }
    
    createBatch();
  });
}

/**
 * Test UI responsiveness during tile creation
 */
async function testUIResponsiveness() {
  console.log('\nTesting UI responsiveness during tile creation...');
  
  // Simulate UI interactions during tile creation
  const container = document.getElementById('test-container');
  const chunksPerSide = 30; // 30x30 chunks = 230,400 tiles
  const chunkSize = 16;
  const tileSize = 6;
  const totalTiles = chunksPerSide * chunksPerSide * chunkSize * chunkSize;
  
  console.log(`  Creating ${totalTiles.toLocaleString()} tiles while simulating UI interactions...`);
  
  let uiInteractions = 0;
  let maxFrameTime = 0;
  
  // Start UI interaction simulation
  const uiInterval = setInterval(() => {
    const start = performance.now();
    // Simulate some UI work
    for (let i = 0; i < 1000; i++) {
      Math.random();
    }
    const frameTime = performance.now() - start;
    maxFrameTime = Math.max(maxFrameTime, frameTime);
    uiInteractions++;
  }, 16); // 60fps
  
  // Create tiles progressively
  const result = await testProgressiveTileCreationWithSize(chunksPerSide, chunkSize, tileSize);
  
  clearInterval(uiInterval);
  
  console.log(`  UI interactions during creation: ${uiInteractions}`);
  console.log(`  Max frame time: ${maxFrameTime.toFixed(2)}ms (target: <16ms for 60fps)`);
  console.log(`  UI responsiveness: ${maxFrameTime < 16 ? '✓ GOOD' : '✗ POOR'}`);
  
  return {
    ...result,
    uiInteractions,
    maxFrameTime,
    responsive: maxFrameTime < 16
  };
}

/**
 * Run all map rendering tests
 */
async function runMapRenderingTests() {
  console.log('=== Map Rendering Performance Tests ===\n');
  
  try {
    console.log('Testing DOM-based tile creation performance...\n');
    
    // Basic tests
    const basicSync = testBasicTileCreation();
    const basicProgressive = await testProgressiveTileCreation();
    
    // Scaling tests
    const scalingResults = await testScalingPerformance();
    
    // UI responsiveness test
    const responsivenessResult = await testUIResponsiveness();
    
    console.log('\n=== Map Rendering Summary ===');
    console.log(`Basic sync (10k tiles): ${basicSync.totalTime.toFixed(2)}ms`);
    console.log(`Basic progressive (10k tiles): ${basicProgressive.totalTime.toFixed(2)}ms`);
    
    console.log('\nScaling results:');
    scalingResults.forEach(result => {
      console.log(`  ${result.description}: ${result.totalTime.toFixed(2)}ms (${result.method})`);
    });
    
    console.log(`\nUI Responsiveness (230k tiles): ${responsivenessResult.responsive ? '✓ RESPONSIVE' : '✗ UNRESPONSIVE'}`);
    console.log(`  Max frame time: ${responsivenessResult.maxFrameTime.toFixed(2)}ms`);
    
    // Find the 50x50 result to check the original issue
    const large50x50 = scalingResults.find(r => r.chunks === 50);
    const passes50x50 = large50x50 && large50x50.totalTime < 5000; // Should complete in under 5 seconds
    
    console.log(`\n50x50 chunks (640k tiles): ${passes50x50 ? '✓ PASSED' : '✗ FAILED'}`);
    if (large50x50) {
      console.log(`  Time: ${(large50x50.totalTime / 1000).toFixed(2)}s`);
      console.log(`  Rate: ${large50x50.tilesPerSecond.toLocaleString()} tiles/sec`);
    }
    
    return {
      passed: passes50x50 && responsivenessResult.responsive,
      basicSync,
      basicProgressive,
      scalingResults,
      responsivenessResult
    };
    
  } catch (error) {
    console.error('Map rendering test failed:', error);
    return {
      passed: false,
      error: error.message
    };
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMapRenderingTests().catch(console.error);
}

export { runMapRenderingTests };