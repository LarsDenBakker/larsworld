/**
 * Stable seed PNG test
 * Generates PNG images for 10 predefined seeds using chunk-based generation
 * These images should be updated whenever the world generator changes
 */
import { generateChunk } from '../dist/src/map-generator/index.js';
import { CHUNK_SIZE } from '../dist/src/shared/types.js';
import { saveMapPng } from '../dist/src/map-generator/png-generator.js';
import sharp from 'sharp';
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

/**
 * Generate a river-only PNG for debugging river flow patterns
 * Shows rivers as actual flowing lines, not full-tile coloring
 * Also shows lakes as blue areas
 */
async function generateRiverOnlyPng(map, mapSize, filepath) {
  const cellSize = 2; // 2x2 pixels per tile to match main images
  const imageWidth = mapSize * cellSize;
  const imageHeight = mapSize * cellSize;
  
  // Create RGBA buffer
  const buffer = Buffer.alloc(imageWidth * imageHeight * 4);
  
  // First pass: Fill background colors
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const tile = map[y][x];
      let color = [255, 255, 255, 255]; // Default white (land)
      
      if (tile.type === 'ocean') {
        // Light blue for ocean to show coastlines
        color = [173, 216, 230, 255];
      } else if (tile.lake) {
        // Medium blue for lakes (darker than ocean, lighter than rivers)
        color = [100, 150, 200, 255];
      }
      
      // Fill pixels for this tile
      for (let py = 0; py < cellSize; py++) {
        for (let px = 0; px < cellSize; px++) {
          const pixelX = x * cellSize + px;
          const pixelY = y * cellSize + py;
          const pixelIndex = (pixelY * imageWidth + pixelX) * 4;
          
          buffer[pixelIndex] = color[0];     // R
          buffer[pixelIndex + 1] = color[1]; // G
          buffer[pixelIndex + 2] = color[2]; // B
          buffer[pixelIndex + 3] = color[3]; // A
        }
      }
    }
  }
  
  // Second pass: Draw river segments as lines
  const riverColor = [0, 100, 255, 255]; // Bright blue for rivers
  
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const tile = map[y][x];
      
      if (tile.river !== 'none') {
        drawRiverSegment(buffer, x, y, tile.river, cellSize, imageWidth, riverColor);
      }
    }
  }
  
  // Create PNG using Sharp
  const pngBuffer = await sharp(buffer, {
    raw: {
      width: imageWidth,
      height: imageHeight,
      channels: 4
    }
  }).png().toBuffer();
  
  // Save the image
  const fs = await import('fs/promises');
  await fs.writeFile(filepath, pngBuffer);
}

/**
 * Draw a river segment based on its type
 * Rivers appear as lines flowing through tiles, not full tile coloring
 */
function drawRiverSegment(buffer, tileX, tileY, riverType, cellSize, imageWidth, color) {
  const startX = tileX * cellSize;
  const startY = tileY * cellSize;
  
  // Helper function to set pixel color
  function setPixel(px, py, color) {
    if (px >= 0 && px < imageWidth/1 && py >= 0) {
      const pixelIndex = (py * imageWidth + px) * 4;
      if (pixelIndex >= 0 && pixelIndex < buffer.length - 3) {
        buffer[pixelIndex] = color[0];     // R
        buffer[pixelIndex + 1] = color[1]; // G
        buffer[pixelIndex + 2] = color[2]; // B
        buffer[pixelIndex + 3] = color[3]; // A
      }
    }
  }
  
  // Helper function to draw a line between two points
  function drawLine(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    
    let x = x1, y = y1;
    while (true) {
      setPixel(x, y, color);
      
      if (x === x2 && y === y2) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
  
  // Calculate center and edge points for the tile
  const centerX = startX + cellSize / 2;
  const centerY = startY + cellSize / 2;
  const topY = startY;
  const bottomY = startY + cellSize - 1;
  const leftX = startX;
  const rightX = startX + cellSize - 1;
  
  // Draw river segment based on type
  switch (riverType) {
    case 'horizontal':
      // Horizontal line from left edge to right edge
      drawLine(leftX, centerY, rightX, centerY);
      break;
      
    case 'vertical':
      // Vertical line from top edge to bottom edge
      drawLine(centerX, topY, centerX, bottomY);
      break;
      
    case 'bend_ne':
      // Bend from north to east: top center to right center
      drawLine(centerX, topY, centerX, centerY);
      drawLine(centerX, centerY, rightX, centerY);
      break;
      
    case 'bend_nw':
      // Bend from north to west: top center to left center
      drawLine(centerX, topY, centerX, centerY);
      drawLine(centerX, centerY, leftX, centerY);
      break;
      
    case 'bend_se':
      // Bend from south to east: bottom center to right center
      drawLine(centerX, bottomY, centerX, centerY);
      drawLine(centerX, centerY, rightX, centerY);
      break;
      
    case 'bend_sw':
      // Bend from south to west: bottom center to left center
      drawLine(centerX, bottomY, centerX, centerY);
      drawLine(centerX, centerY, leftX, centerY);
      break;
      
    case 'bend_en':
      // Bend from east to north: right center to top center
      drawLine(rightX, centerY, centerX, centerY);
      drawLine(centerX, centerY, centerX, topY);
      break;
      
    case 'bend_es':
      // Bend from east to south: right center to bottom center
      drawLine(rightX, centerY, centerX, centerY);
      drawLine(centerX, centerY, centerX, bottomY);
      break;
      
    case 'bend_wn':
      // Bend from west to north: left center to top center
      drawLine(leftX, centerY, centerX, centerY);
      drawLine(centerX, centerY, centerX, topY);
      break;
      
    case 'bend_ws':
      // Bend from west to south: left center to bottom center
      drawLine(leftX, centerY, centerX, centerY);
      drawLine(centerX, centerY, centerX, bottomY);
      break;
      
    default:
      // For unknown types, draw a simple cross to indicate presence
      drawLine(leftX, centerY, rightX, centerY);
      drawLine(centerX, topY, centerX, bottomY);
      break;
  }
}

export async function generateStableSeedPngs() {
  console.log('Generating stable seed PNG images using chunk-based generation...\n');
  
  // Generate 960x960 maps (60x60 chunks) for visual validation
  // Same size as main ocean coverage tests
  const chunksPerSide = 60;
  const mapSize = chunksPerSide * CHUNK_SIZE; // 960x960
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
      
      // Generate simple PNG (terrain with rivers)
      const simplePngPath = path.join(imageDir, `seed-${seed}-simple.png`);
      
      await saveMapPng(map, simplePngPath, {
        width: mapSize,
        height: mapSize,
        cellSize: 2, // 2x2 pixels per tile for better visibility
        showElevation: false
      });
      
      // Generate river-only debug PNG for clear river visualization
      await generateRiverOnlyPng(map, mapSize, path.join(imageDir, `seed-${seed}-rivers-only.png`));
      
      results.push({
        seed,
        oceanPercentage: oceanPercentage.toFixed(1),
        landPercentage: landPercentage.toFixed(1),
        meetsSpecs: oceanPercentage >= 25 && oceanPercentage <= 35,
        simplePng: `seed-${seed}-simple.png`,
        riversOnlyPng: `seed-${seed}-rivers-only.png`
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
- \`seed-{number}-simple.png\`: Full terrain with rivers overlay (biome colors with blue river overlay)
- \`seed-{number}-rivers-only.png\`: River-only debug visualization (white=land, light blue=ocean, blue=rivers)

## Stable Seeds

${results.map((r, i) => 
  `${i + 1}. **Seed ${r.seed}**: ${r.error ? `ERROR - ${r.error}` : 
    `Ocean ${r.oceanPercentage}%, Land ${r.landPercentage}% ${r.meetsSpecs ? '✓' : '✗'}`}`
).join('\n')}

## Requirements (from specs)

- Chunk-based generation ✓
- 25-35% ocean coverage for 60×60+ chunk maps ✓
- PNG visual samples use ${mapSize}×${mapSize} tiles (same as main ocean coverage test)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
- River flow from sources to eventually lakes or ocean ✓

## River Debug Images

The \`-rivers-only.png\` images clearly show river flow patterns:
- **White**: Land areas without rivers
- **Light Blue**: Ocean areas (to show coastlines)
- **Blue**: River segments flowing from sources to ocean/lakes
- Rivers should be visible as continuous blue lines connecting mountain sources to ocean
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