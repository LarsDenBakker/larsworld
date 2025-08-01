#!/usr/bin/env node

/**
 * Generate static biome PNG files for serving as static assets
 * This script creates PNG files for all biome types with elevation levels
 * and saves them to web/public/biomes/ for static file serving
 */

import { createCanvas } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Biome definitions matching the frontend
const BIOME_COLORS = {
  deep_ocean: [65, 105, 225],       // Royal blue
  shallow_ocean: [100, 150, 230],   // Medium blue
  desert: [238, 203, 173],          // Sandy beige
  tundra: [176, 196, 222],          // Light steel blue
  arctic: [248, 248, 255],          // Ghost white
  swamp: [85, 107, 47],             // Dark olive green
  grassland: [124, 252, 0],         // Lawn green
  forest: [34, 139, 34],            // Forest green
  taiga: [60, 100, 60],             // Dark green
  savanna: [189, 183, 107],         // Dark khaki
  tropical_forest: [0, 100, 0],     // Dark green
  alpine: [169, 169, 169]           // Dark gray
};

/**
 * Generate a single biome PNG file
 */
function generateBiomePNG(biome, elevation, tileSize = 6) {
  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext('2d');

  // Get base color and apply elevation shading
  const baseColor = BIOME_COLORS[biome] || [128, 128, 128];
  const darkeningFactor = 1 - (elevation * 0.4); // Reduce up to 40% brightness at max elevation
  const shadedColor = [
    Math.floor(baseColor[0] * darkeningFactor),
    Math.floor(baseColor[1] * darkeningFactor),
    Math.floor(baseColor[2] * darkeningFactor)
  ];

  // Fill the entire tile with the biome color
  ctx.fillStyle = `rgb(${shadedColor[0]}, ${shadedColor[1]}, ${shadedColor[2]})`;
  ctx.fillRect(0, 0, tileSize, tileSize);

  return canvas.toBuffer('image/png');
}

/**
 * Generate base biome PNGs without elevation (for CSS gradient approach)
 */
function generateBaseBiomePNG(biome, tileSize = 6) {
  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext('2d');

  // Use base color without elevation shading
  const baseColor = BIOME_COLORS[biome] || [128, 128, 128];
  ctx.fillStyle = `rgb(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})`;
  ctx.fillRect(0, 0, tileSize, tileSize);

  return canvas.toBuffer('image/png');
}

/**
 * Main function to generate all biome PNGs
 */
async function generateAllBiomePNGs() {
  console.log('🎨 Generating static biome PNG files...');
  
  const biomesDir = path.join(__dirname, '../web/public/biomes');
  
  // Ensure directory exists
  await fs.mkdir(biomesDir, { recursive: true });

  const biomes = Object.keys(BIOME_COLORS);
  const tileSize = 6;
  let filesGenerated = 0;

  console.log(`📁 Output directory: ${biomesDir}`);
  console.log(`🧩 Generating for ${biomes.length} biomes with tile size ${tileSize}px`);

  // Generate separate PNGs for each biome with elevation levels
  console.log('\n📊 Generating elevation-specific PNGs...');
  for (const biome of biomes) {
    for (let elevationLevel = 0; elevationLevel <= 10; elevationLevel++) {
      const elevation = elevationLevel / 10;
      const filename = `${biome}-${elevationLevel}.png`;
      const filepath = path.join(biomesDir, filename);
      
      const pngBuffer = generateBiomePNG(biome, elevation, tileSize);
      await fs.writeFile(filepath, pngBuffer);
      filesGenerated++;
    }
  }

  // Generate base biome PNGs (without elevation) for CSS gradient approach
  console.log('\n🎨 Generating base biome PNGs (for CSS gradients)...');
  const baseDir = path.join(biomesDir, 'base');
  await fs.mkdir(baseDir, { recursive: true });
  
  for (const biome of biomes) {
    const filename = `${biome}.png`;
    const filepath = path.join(baseDir, filename);
    
    const pngBuffer = generateBaseBiomePNG(biome, tileSize);
    await fs.writeFile(filepath, pngBuffer);
    filesGenerated++;
  }

  console.log(`\n✅ Generated ${filesGenerated} PNG files:`);
  console.log(`   • ${biomes.length * 11} elevation-specific PNGs (${biomes.length} biomes × 11 levels)`);
  console.log(`   • ${biomes.length} base PNGs for CSS gradient approach`);
  console.log(`\n📂 Files location:`);
  console.log(`   • Elevation PNGs: ${biomesDir}/`);
  console.log(`   • Base PNGs: ${baseDir}/`);
  
  // Generate an index file for reference
  const indexContent = {
    generated: new Date().toISOString(),
    tileSize,
    biomes: biomes.sort(),
    elevationLevels: 11,
    totalFiles: filesGenerated,
    structure: {
      elevationSpecific: `{biome}-{0-10}.png`,
      baseBiomes: `base/{biome}.png`
    }
  };
  
  await fs.writeFile(
    path.join(biomesDir, 'index.json'), 
    JSON.stringify(indexContent, null, 2)
  );
  
  console.log(`\n📋 Generated index.json with file structure information`);
  console.log('🎯 Ready to test both approaches: elevation PNGs vs CSS gradients');
}

// Run the script
generateAllBiomePNGs().catch(console.error);