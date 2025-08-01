/**
 * Quick test for progressive tile creation performance
 */
import { JSDOM } from 'jsdom';

// Setup DOM environment for testing
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="test-container"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = (callback) => setTimeout(callback, 16); // 60fps simulation

/**
 * Test the new progressive approach
 */
async function testProgressiveApproach() {
  console.log('Testing NEW progressive tile creation approach...');
  
  const container = document.getElementById('test-container');
  const chunkSize = 16;
  const tileSize = 6;
  const chunksPerSide = 25; // 25x25 chunks = 160,000 tiles
  const totalTiles = chunksPerSide * chunksPerSide * chunkSize * chunkSize;
  
  console.log(`Creating ${totalTiles.toLocaleString()} tiles (${chunksPerSide}x${chunksPerSide} chunks)`);
  
  const startTime = performance.now();
  const batchSize = 100; // Create 100 tiles per frame
  let tilesCreated = 0;
  
  return new Promise((resolve) => {
    function createBatch() {
      const batchStart = performance.now();
      let batchCount = 0;
      
      // Create tiles up to batch size or until done
      while (batchCount < batchSize && tilesCreated < totalTiles) {
        // Calculate tile coordinates
        const tilesPerRow = chunksPerSide * chunkSize;
        const globalY = Math.floor(tilesCreated / tilesPerRow);
        const globalX = tilesCreated % tilesPerRow;
        
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
      
      if (tilesCreated < totalTiles) {
        // Progress logging
        if (tilesCreated % 10000 === 0) {
          const progress = (tilesCreated / totalTiles * 100).toFixed(1);
          const elapsed = performance.now() - startTime;
          console.log(`  Progress: ${progress}% (${tilesCreated.toLocaleString()}/${totalTiles.toLocaleString()}) - ${elapsed.toFixed(0)}ms elapsed`);
        }
        
        // Continue with next batch
        requestAnimationFrame(createBatch);
      } else {
        // Done
        const totalTime = performance.now() - startTime;
        console.log(`  ✅ COMPLETED: ${totalTiles.toLocaleString()} tiles in ${totalTime.toFixed(2)}ms`);
        console.log(`  Rate: ${(totalTiles / totalTime * 1000).toLocaleString()} tiles/second`);
        console.log(`  Batches: ${Math.ceil(totalTiles / batchSize)} (${batchSize} tiles each)`);
        
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
 * Test 50x50 chunk performance - the original problem case
 */
async function test50x50Performance() {
  console.log('\nTesting 50x50 chunks (the original problem case)...');
  
  const container = document.getElementById('test-container');
  const chunkSize = 16;
  const tileSize = 6;
  const chunksPerSide = 50; // 50x50 chunks = 640,000 tiles
  const totalTiles = chunksPerSide * chunksPerSide * chunkSize * chunkSize;
  
  console.log(`Creating ${totalTiles.toLocaleString()} tiles (${chunksPerSide}x${chunksPerSide} chunks)`);
  
  const startTime = performance.now();
  const batchSize = 150; // Slightly larger batch for big maps
  let tilesCreated = 0;
  
  return new Promise((resolve) => {
    function createBatch() {
      const batchStart = performance.now();
      let batchCount = 0;
      
      // Create tiles up to batch size or until done
      while (batchCount < batchSize && tilesCreated < totalTiles) {
        // Calculate tile coordinates
        const tilesPerRow = chunksPerSide * chunkSize;
        const globalY = Math.floor(tilesCreated / tilesPerRow);
        const globalX = tilesCreated % tilesPerRow;
        
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
      
      if (tilesCreated < totalTiles) {
        // Progress logging every 50k tiles
        if (tilesCreated % 50000 === 0) {
          const progress = (tilesCreated / totalTiles * 100).toFixed(1);
          const elapsed = performance.now() - startTime;
          console.log(`  Progress: ${progress}% (${tilesCreated.toLocaleString()}/${totalTiles.toLocaleString()}) - ${(elapsed/1000).toFixed(1)}s elapsed`);
        }
        
        // Continue with next batch
        requestAnimationFrame(createBatch);
      } else {
        // Done
        const totalTime = performance.now() - startTime;
        console.log(`  ✅ COMPLETED: ${totalTiles.toLocaleString()} tiles in ${(totalTime/1000).toFixed(2)}s`);
        console.log(`  Rate: ${(totalTiles / totalTime * 1000).toLocaleString()} tiles/second`);
        console.log(`  Batches: ${Math.ceil(totalTiles / batchSize)} (${batchSize} tiles each)`);
        
        // Performance assessment
        const acceptableTime = 10000; // 10 seconds is acceptable for 640k tiles
        const passes = totalTime < acceptableTime;
        console.log(`  Performance: ${passes ? '✅ GOOD' : '❌ NEEDS IMPROVEMENT'} (${(totalTime/1000).toFixed(1)}s vs ${acceptableTime/1000}s target)`);
        
        // Cleanup
        container.innerHTML = '';
        
        resolve({
          totalTiles,
          totalTime,
          tilesPerSecond: totalTiles / totalTime * 1000,
          batches: Math.ceil(totalTiles / batchSize),
          passes
        });
      }
    }
    
    createBatch();
  });
}

/**
 * Run quick verification tests
 */
async function runQuickTests() {
  console.log('=== Quick Progressive Tile Creation Tests ===\n');
  
  try {
    // Test medium size first
    const mediumResult = await testProgressiveApproach();
    
    // If medium test is reasonably fast, test the 50x50 case
    if (mediumResult.totalTime < 20000) { // If 25x25 takes less than 20 seconds
      console.log('\nMedium test passed, testing 50x50...');
      const largeResult = await test50x50Performance();
      
      console.log('\n=== Quick Test Summary ===');
      console.log(`25x25 chunks (160k tiles): ${(mediumResult.totalTime/1000).toFixed(1)}s`);
      console.log(`50x50 chunks (640k tiles): ${(largeResult.totalTime/1000).toFixed(1)}s - ${largeResult.passes ? 'PASSED' : 'FAILED'}`);
      
      return {
        passed: largeResult.passes,
        mediumResult,
        largeResult
      };
    } else {
      console.log(`\nMedium test too slow (${(mediumResult.totalTime/1000).toFixed(1)}s), skipping 50x50 test`);
      return {
        passed: false,
        mediumResult,
        reason: 'Medium test too slow'
      };
    }
  } catch (error) {
    console.error('Quick test failed:', error);
    return {
      passed: false,
      error: error.message
    };
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQuickTests().catch(console.error);
}

export { runQuickTests };