/**
 * Performance tests for map generation optimizations
 */
import { generateChunk, benchmarkChunkGeneration, clearGenerationCaches, getCacheStats } from '../dist/src/map-generator/index.js';
import { CHUNK_SIZE } from '../dist/src/shared/types.js';

/**
 * Test basic chunk generation performance
 */
function testBasicPerformance() {
  console.log('Testing basic chunk generation performance...');
  
  const singleChunkStart = performance.now();
  const chunk = generateChunk(0, 0, 12345);
  const singleChunkTime = performance.now() - singleChunkStart;
  
  console.log(`Single chunk (${CHUNK_SIZE}x${CHUNK_SIZE} = ${CHUNK_SIZE * CHUNK_SIZE} tiles) generated in ${singleChunkTime.toFixed(2)}ms`);
  
  // Validate chunk structure
  if (chunk.length !== CHUNK_SIZE || chunk[0].length !== CHUNK_SIZE) {
    throw new Error(`Chunk has wrong dimensions: ${chunk.length}x${chunk[0].length}`);
  }
  
  return singleChunkTime;
}

/**
 * Test performance with different chunk counts
 */
function testScalingPerformance() {
  console.log('\nTesting scaling performance...');
  
  const testSizes = [1, 4, 16, 64]; // 1x1, 2x2, 4x4, 8x8 chunk grids
  const results = [];
  
  for (const numChunks of testSizes) {
    clearGenerationCaches(); // Start fresh for each test
    
    const benchmark = benchmarkChunkGeneration(numChunks, 12345);
    const totalTiles = numChunks * CHUNK_SIZE * CHUNK_SIZE;
    const gridSize = Math.ceil(Math.sqrt(numChunks));
    
    console.log(`  ${gridSize}x${gridSize} chunks (${numChunks} total, ${totalTiles.toLocaleString()} tiles):`);
    console.log(`    Total time: ${benchmark.totalTime.toFixed(2)}ms`);
    console.log(`    Chunks/sec: ${benchmark.chunksPerSecond.toFixed(1)}`);
    console.log(`    Tiles/sec: ${benchmark.tilesPerSecond.toLocaleString()}`);
    console.log(`    Avg per chunk: ${benchmark.averageTimePerChunk.toFixed(2)}ms`);
    
    results.push({
      numChunks,
      totalTiles,
      ...benchmark
    });
  }
  
  return results;
}

/**
 * Test 60x60 chunk performance (the original bottleneck)
 */
function test60x60Performance() {
  console.log('\nTesting 60x60 chunk generation performance...');
  
  clearGenerationCaches();
  
  const chunksPerSide = 60;
  const totalChunks = chunksPerSide * chunksPerSide; // 3,600 chunks
  const totalTiles = totalChunks * CHUNK_SIZE * CHUNK_SIZE; // 921,600 tiles
  
  console.log(`Generating ${chunksPerSide}x${chunksPerSide} chunks = ${totalChunks.toLocaleString()} chunks = ${totalTiles.toLocaleString()} tiles`);
  
  const startTime = performance.now();
  let chunksGenerated = 0;
  
  // Generate chunks in batches for progress reporting
  const batchSize = 600; // Report every 600 chunks (10% progress)
  
  for (let batch = 0; batch < totalChunks; batch += batchSize) {
    const batchStart = performance.now();
    
    const endChunk = Math.min(batch + batchSize, totalChunks);
    for (let i = batch; i < endChunk; i++) {
      const chunkX = i % chunksPerSide;
      const chunkY = Math.floor(i / chunksPerSide);
      generateChunk(chunkX, chunkY, 12345);
      chunksGenerated++;
    }
    
    const batchTime = performance.now() - batchStart;
    const totalTime = performance.now() - startTime;
    const progress = (chunksGenerated / totalChunks) * 100;
    
    console.log(`    Progress: ${progress.toFixed(1)}% (${chunksGenerated}/${totalChunks} chunks) - Batch: ${batchTime.toFixed(0)}ms, Total: ${(totalTime/1000).toFixed(1)}s`);
  }
  
  const totalTime = performance.now() - startTime;
  const cacheStats = getCacheStats();
  
  console.log(`\n60x60 Chunk Generation Results:`);
  console.log(`  Total time: ${(totalTime/1000).toFixed(2)} seconds`);
  console.log(`  Chunks/sec: ${((chunksGenerated / totalTime) * 1000).toFixed(1)}`);
  console.log(`  Tiles/sec: ${((totalTiles / totalTime) * 1000).toLocaleString()}`);
  console.log(`  Cache usage: ${cacheStats.continents} continent data, ${cacheStats.tileNoise} tile noise, ${cacheStats.riverNoise} river noise`);
  
  return {
    totalTime,
    chunksGenerated,
    totalTiles,
    chunksPerSecond: (chunksGenerated / totalTime) * 1000,
    tilesPerSecond: (totalTiles / totalTime) * 1000,
    cacheStats
  };
}

/**
 * Test memory usage and cache effectiveness
 */
function testCacheEffectiveness() {
  console.log('\nTesting cache effectiveness...');
  
  clearGenerationCaches();
  
  // Generate same chunk multiple times to test cache hits
  const seed = 12345;
  const iterations = 100;
  
  const startTime = performance.now();
  for (let i = 0; i < iterations; i++) {
    generateChunk(0, 0, seed);
  }
  const cacheHitTime = performance.now() - startTime;
  
  clearGenerationCaches();
  
  // Generate different chunks to test cache misses
  const startTime2 = performance.now();
  for (let i = 0; i < iterations; i++) {
    generateChunk(i % 10, Math.floor(i / 10), seed);
  }
  const cacheMissTime = performance.now() - startTime2;
  
  console.log(`  Cache hits (same chunk): ${cacheHitTime.toFixed(2)}ms for ${iterations} generations`);
  console.log(`  Cache misses (diff chunks): ${cacheMissTime.toFixed(2)}ms for ${iterations} generations`);
  console.log(`  Performance improvement: ${(cacheMissTime / cacheHitTime).toFixed(1)}x faster with cache hits`);
  
  return {
    cacheHitTime,
    cacheMissTime,
    improvement: cacheMissTime / cacheHitTime
  };
}

/**
 * Run all performance tests
 */
async function runPerformanceTests() {
  console.log('=== Map Generation Performance Tests ===\n');
  
  try {
    const singleChunkTime = testBasicPerformance();
    const scalingResults = testScalingPerformance();
    const cacheResults = testCacheEffectiveness();
    
    // Run 60x60 test only if basic performance is reasonable
    if (singleChunkTime < 50) { // If single chunk takes less than 50ms
      console.log('\nSingle chunk performance is good, running 60x60 test...');
      const largeMapResults = test60x60Performance();
      
      console.log('\n=== Performance Summary ===');
      console.log(`Single chunk: ${singleChunkTime.toFixed(2)}ms`);
      console.log(`60x60 chunks: ${(largeMapResults.totalTime/1000).toFixed(2)}s (${largeMapResults.chunksPerSecond.toFixed(1)} chunks/sec)`);
      console.log(`Cache effectiveness: ${cacheResults.improvement.toFixed(1)}x improvement`);
      
      // Performance targets
      const targetTime = 30; // 30 seconds for 60x60 chunks
      const meetTarget = largeMapResults.totalTime < (targetTime * 1000);
      
      console.log(`\nPerformance target (${targetTime}s for 60x60): ${meetTarget ? '✓ PASSED' : '✗ FAILED'}`);
      
      return {
        passed: meetTarget,
        singleChunkTime,
        largeMapTime: largeMapResults.totalTime / 1000,
        targetTime,
        cacheImprovement: cacheResults.improvement
      };
    } else {
      console.log(`\nSingle chunk too slow (${singleChunkTime.toFixed(2)}ms), skipping 60x60 test`);
      return {
        passed: false,
        singleChunkTime,
        reason: 'Single chunk performance too slow'
      };
    }
  } catch (error) {
    console.error('Performance test failed:', error);
    return {
      passed: false,
      error: error.message
    };
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests().catch(console.error);
}

export { runPerformanceTests };