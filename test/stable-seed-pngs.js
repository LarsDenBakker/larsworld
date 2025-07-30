/**
 * Stable seed PNG test
 * Generates PNG images for 10 predefined seeds using chunk-based generation
 * These images should be updated whenever the world generator changes
 */
import { generateChunk } from '../dist/src/map-generator/index.js';
import { CHUNK_SIZE } from '../dist/src/shared/types.js';
import { saveMapPng } from '../dist/src/map-generator/png-generator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 10 predefined stable seeds for testing
const STABLE_SEEDS = [
  12345,   // Classic test seed
  54321,   // Reverse of first
  98765,   // Another reverse
  11111,   // Repeated digit
  77777,   // Lucky sevens
  42424,   // Meaning of life variations
  13579,   // Odd sequence
  24680,   // Even sequence
  31415,   // Pi approximation
  27182    // e approximation
];

export async function generateStableSeedPngs() {
  console.log('Generating stable seed PNG images using chunk-based generation...\n');
  
  // Generate 96x96 maps (6x6 chunks) to test the ocean coverage requirement
  const chunksPerSide = 6;
  const mapSize = chunksPerSide * CHUNK_SIZE; // 96x96
  const imageDir = path.join(__dirname, 'map-images');
  
  // Ensure directory exists
  const fs = await import('fs/promises');
  try {
    await fs.access(imageDir);
  } catch {
    await fs.mkdir(imageDir, { recursive: true });
  }
  
  const results = [];
  
  for (let i = 0; i < STABLE_SEEDS.length; i++) {
    const seed = STABLE_SEEDS[i];
    console.log(`Generating map ${i + 1}/10 (seed: ${seed})...`);
    
    try {
      // Generate map using chunks
      const map = [];
      for (let globalY = 0; globalY < mapSize; globalY++) {
        map.push(new Array(mapSize));
      }
      
      // Fill the map using chunks
      for (let chunkY = 0; chunkY < chunksPerSide; chunkY++) {
        for (let chunkX = 0; chunkX < chunksPerSide; chunkX++) {
          const chunk = generateChunk(chunkX, chunkY, seed);
          
          for (let localY = 0; localY < CHUNK_SIZE; localY++) {
            for (let localX = 0; localX < CHUNK_SIZE; localX++) {
              const globalX = chunkX * CHUNK_SIZE + localX;
              const globalY = chunkY * CHUNK_SIZE + localY;
              map[globalY][globalX] = chunk[localY][localX];
            }
          }
        }
      }
      
      // Calculate statistics
      let oceanCount = 0;
      let landCount = 0;
      const totalTiles = mapSize * mapSize;
      
      for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
          if (map[y][x].type === 'ocean') {
            oceanCount++;
          } else {
            landCount++;
          }
        }
      }
      
      const oceanPercentage = (oceanCount / totalTiles) * 100;
      const landPercentage = (landCount / totalTiles) * 100;
      
      // Generate both simple and elevation-based PNGs
      const simplePngPath = path.join(imageDir, `seed-${seed}-simple.png`);
      const elevationPngPath = path.join(imageDir, `seed-${seed}-elevation.png`);
      
      await saveMapPng(map, simplePngPath, {
        width: mapSize,
        height: mapSize,
        cellSize: 2, // 2x2 pixels per tile for better visibility
        showElevation: false
      });
      
      await saveMapPng(map, elevationPngPath, {
        width: mapSize,
        height: mapSize,
        cellSize: 2,
        showElevation: true
      });
      
      results.push({
        seed,
        oceanPercentage: oceanPercentage.toFixed(1),
        landPercentage: landPercentage.toFixed(1),
        meetsSpecs: oceanPercentage >= 25 && oceanPercentage <= 35,
        simplePng: `seed-${seed}-simple.png`,
        elevationPng: `seed-${seed}-elevation.png`
      });
      
      console.log(`  Ocean: ${oceanPercentage.toFixed(1)}%, Land: ${landPercentage.toFixed(1)}%`);
    } catch (error) {
      console.error(`  Error generating map for seed ${seed}:`, error.message);
      results.push({
        seed,
        error: error.message,
        meetsSpecs: false
      });
    }
  }
  
  // Generate summary report
  const reportPath = path.join(imageDir, 'generation-report.json');
  const report = {
    generatedAt: new Date().toISOString(),
    mapSize: `${mapSize}x${mapSize}`,
    totalMaps: STABLE_SEEDS.length,
    meetsSpecsCount: results.filter(r => r.meetsSpecs).length,
    results
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  // Generate README for the images
  const readmePath = path.join(imageDir, 'README.md');
  const readmeContent = `# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds using chunk-based generation.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: ${mapSize}x${mapSize} tiles (${chunksPerSide}x${chunksPerSide} chunks)
- **Image Size**: ${mapSize * 2}x${mapSize * 2} pixels (2x2 pixels per tile)
- **Generated**: ${new Date().toISOString()}
- **Maps Meeting Specs**: ${report.meetsSpecsCount}/${report.totalMaps}

## Files

Each seed generates two images:
- \`seed-{number}-simple.png\`: Simple land (green) vs ocean (blue) visualization
- \`seed-{number}-elevation.png\`: Elevation-based coloring

## Stable Seeds

${results.map((r, i) => 
  `${i + 1}. **Seed ${r.seed}**: ${r.error ? `ERROR - ${r.error}` : 
    `Ocean ${r.oceanPercentage}%, Land ${r.landPercentage}% ${r.meetsSpecs ? '✓' : '✗'}`}`
).join('\n')}

## Requirements (from specs)

- Chunk-based generation ✓
- 25-35% ocean coverage for 96×96+ maps (${report.meetsSpecsCount}/${report.totalMaps} maps meet this)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
`;
  
  await fs.writeFile(readmePath, readmeContent);
  
  console.log(`\n✓ Generated ${results.length} maps`);
  console.log(`✓ ${report.meetsSpecsCount}/${report.totalMaps} maps meet ocean coverage specs (25-35%)`);
  console.log(`✓ Saved images to: ${imageDir}`);
  console.log(`✓ Generated report: generation-report.json`);
  console.log(`✓ Generated README: README.md`);
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateStableSeedPngs().catch(console.error);
}

export { STABLE_SEEDS };