#!/usr/bin/env node

/**
 * CLI utility to generate world map screenshots for visual validation
 * Usage: node scripts/generate-map-screenshots.js [seeds...]
 */

import { generateMapPage } from '../dist/src/map-generator/paginated.js';
import { compactToTile, BIOME_TYPES } from '../dist/src/shared/types.js';
import fs from 'fs';
import path from 'path';

// Biome color mapping for visualization
const BIOME_COLORS = {
  'ocean': '#1e3a8a',         // Deep blue
  'shallow_water': '#3b82f6', // Light blue
  'beach': '#fbbf24',         // Sandy yellow
  'desert': '#eab308',        // Desert yellow
  'grassland': '#65a30d',     // Green
  'forest': '#166534',        // Dark green
  'tundra': '#e5e7eb',        // Light gray
  'mountain': '#6b7280',      // Gray
  'snow': '#f9fafb',          // White
  'swamp': '#059669'          // Dark teal
};

/**
 * Convert RGB hex color to RGB array
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/**
 * Generate a simple PPM image file (portable pixmap)
 * This is a simple image format that can be viewed/converted easily
 */
function generatePPMImage(width, height, getPixelColor, filename) {
  const lines = [
    'P3',
    `${width} ${height}`,
    '255'
  ];
  
  for (let y = 0; y < height; y++) {
    const rowColors = [];
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixelColor(x, y);
      rowColors.push(`${r} ${g} ${b}`);
    }
    lines.push(rowColors.join(' '));
  }
  
  fs.writeFileSync(filename, lines.join('\n'));
  console.log(`Generated ${filename} (${width}x${height})`);
}

/**
 * Generate a world map image from the paginated generator
 */
function generateWorldMapImage(seed, outputPath, scale = 8) {
  const mapWidth = 1000;
  const mapHeight = 1000;
  const imageWidth = Math.floor(mapWidth / scale);
  const imageHeight = Math.floor(mapHeight / scale);
  
  console.log(`Generating ${imageWidth}x${imageHeight} world map for seed "${seed}"...`);
  
  // Generate map data in larger chunks for efficiency
  const pageSize = 50; // Generate 50 rows at a time
  const totalPages = Math.ceil(mapHeight / pageSize);
  const mapData = [];
  
  console.log(`Generating ${totalPages} pages of map data...`);
  
  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    process.stdout.write(`Page ${pageNum + 1}/${totalPages}\r`);
    
    const page = generateMapPage({ page: pageNum, pageSize, seed });
    
    for (let rowIdx = 0; rowIdx < page.tiles.length; rowIdx++) {
      const y = page.startY + rowIdx;
      if (y < mapHeight) {
        const row = [];
        for (let x = 0; x < mapWidth; x++) {
          const compactTile = page.tiles[rowIdx][x];
          const tile = compactToTile(compactTile, x, y);
          row.push(tile);
        }
        mapData[y] = row;
      }
    }
  }
  
  console.log('\nGenerating image...');
  
  function getPixelColor(imageX, imageY) {
    // Scale image coordinates to map coordinates
    const mapX = Math.floor(imageX * scale);
    const mapY = Math.floor(imageY * scale);
    
    // Clamp to map bounds
    const clampedX = Math.min(Math.max(mapX, 0), mapWidth - 1);
    const clampedY = Math.min(Math.max(mapY, 0), mapHeight - 1);
    
    const tile = mapData[clampedY][clampedX];
    const color = BIOME_COLORS[tile.type] || '#000000';
    return hexToRgb(color);
  }
  
  generatePPMImage(imageWidth, imageHeight, getPixelColor, outputPath);
  
  // Generate statistics using the already generated map data
  const biomeStats = {};
  let totalSamples = 0;
  
  // Sample biomes for statistics (every 20th pixel)
  for (let y = 0; y < mapHeight; y += 20) {
    for (let x = 0; x < mapWidth; x += 20) {
      const tile = mapData[y][x];
      biomeStats[tile.type] = (biomeStats[tile.type] || 0) + 1;
      totalSamples++;
    }
  }
  
  console.log('\nBiome distribution:');
  for (const [biome, count] of Object.entries(biomeStats)) {
    const percentage = (count / totalSamples) * 100;
    console.log(`  ${biome}: ${percentage.toFixed(1)}%`);
  }
  console.log('');
}

/**
 * Generate images for multiple seeds
 */
function generateMultipleWorlds(seeds) {
  const outputDir = 'map-screenshots';
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`Generating world map screenshots in ${outputDir}/\n`);
  
  for (const seed of seeds) {
    const safeSeed = seed.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = path.join(outputDir, `world_${safeSeed}.ppm`);
    
    try {
      generateWorldMapImage(seed, filename);
    } catch (error) {
      console.error(`Error generating map for seed "${seed}":`, error.message);
    }
  }
  
  console.log(`\nGenerated ${seeds.length} world map screenshots.`);
  console.log('To convert PPM files to PNG, you can use ImageMagick:');
  console.log(`  mogrify -format png ${outputDir}/*.ppm`);
  console.log('Or view them directly with many image viewers.');
}

// Main CLI logic
function main() {
  const args = process.argv.slice(2);
  
  // Default seeds if none provided
  const defaultSeeds = [
    'dwarf_fortress_world_1',
    'dwarf_fortress_world_2', 
    'continents_test',
    'ocean_boundaries_test',
    'biome_diversity_test'
  ];
  
  const seeds = args.length > 0 ? args : defaultSeeds;
  
  console.log('Dwarf Fortress World Generator - Screenshot Utility');
  console.log('==================================================\n');
  
  generateMultipleWorlds(seeds);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}