/**
 * PNG generation utility for world maps
 * Converts map tiles to PNG images for visualization
 */
import sharp from 'sharp';
import { Tile } from './index.js';
import { BiomeType, ElevationType, RiverType } from '../shared/types.js';

export interface PngGenerationOptions {
  width: number;
  height: number;
  cellSize?: number; // Size of each tile in pixels
  showElevation?: boolean; // Whether to color by elevation
  showBiomes?: boolean; // Whether to show biome colors (default: true)
  showRivers?: boolean; // Whether to overlay rivers (default: true)
  showLakes?: boolean; // Whether to overlay lakes (default: true)
}

/**
 * Biome color palette - realistic earth-tone colors for each biome
 * Colors chosen to represent real-world biome appearances
 */
const BIOME_COLORS: Record<BiomeType, [number, number, number]> = {
  deep_ocean: [65, 105, 225],       // Royal blue (was shallow ocean)
  shallow_ocean: [100, 150, 230],   // Medium blue (darker than before, lighter than deep)  
  desert: [238, 203, 173],          // Sandy beige
  tundra: [176, 196, 222],          // Light steel blue (cold, sparse)
  arctic: [248, 248, 255],          // Ghost white (ice/snow)
  swamp: [85, 107, 47],             // Dark olive green (muddy water)
  grassland: [124, 252, 0],         // Lawn green (vibrant grass)
  forest: [34, 139, 34],            // Forest green (dense temperate forest)
  taiga: [60, 100, 60],             // Dark green (coniferous forest)
  savanna: [189, 183, 107],         // Dark khaki (dry grassland)
  tropical_forest: [0, 100, 0],     // Dark green (dense jungle)
  alpine: [169, 169, 169]           // Dark gray (rocky mountain peaks)
};

/**
 * Apply elevation-based darkening to a color
 */
function applyElevationShading(baseColor: [number, number, number], elevation: number): [number, number, number] {
  // Higher elevation = darker color (simulate shadows/altitude effects)
  const darkeningFactor = 1 - (elevation * 0.4); // Reduce up to 40% brightness at max elevation
  return [
    Math.floor(baseColor[0] * darkeningFactor),
    Math.floor(baseColor[1] * darkeningFactor),
    Math.floor(baseColor[2] * darkeningFactor)
  ];
}

/**
 * Apply river overlay to a base terrain color
 * Rivers are rendered as blue lines with varying intensity
 */
function applyRiverOverlay(baseColor: [number, number, number], riverType: RiverType): [number, number, number] {
  if (riverType === 'none') {
    return baseColor;
  }
  
  // River color - bright blue
  const riverColor: [number, number, number] = [64, 164, 223];
  
  // Blend river with terrain - rivers are prominent but don't completely hide terrain
  const riverStrength = 0.7; // 70% river, 30% terrain
  const terrainStrength = 1 - riverStrength;
  
  return [
    Math.floor(baseColor[0] * terrainStrength + riverColor[0] * riverStrength),
    Math.floor(baseColor[1] * terrainStrength + riverColor[1] * riverStrength),
    Math.floor(baseColor[2] * terrainStrength + riverColor[2] * riverStrength)
  ];
}

/**
 * Apply lake overlay to a base terrain color
 * Lakes are rendered as darker blue water bodies
 */
function applyLakeOverlay(baseColor: [number, number, number], hasLake: boolean): [number, number, number] {
  if (!hasLake) {
    return baseColor;
  }
  
  // Lake color - darker blue than rivers but still blue water
  const lakeColor: [number, number, number] = [30, 120, 180];
  
  // Lakes are more opaque than rivers - they replace most of the terrain color
  const lakeStrength = 0.85; // 85% lake, 15% terrain for slight texture
  const terrainStrength = 1 - lakeStrength;
  
  return [
    Math.floor(baseColor[0] * terrainStrength + lakeColor[0] * lakeStrength),
    Math.floor(baseColor[1] * terrainStrength + lakeColor[1] * lakeStrength),
    Math.floor(baseColor[2] * terrainStrength + lakeColor[2] * lakeStrength)
  ];
}

/**
 * Generate a PNG image from a map of tiles
 */
export async function generateMapPng(
  map: Tile[][],
  options: PngGenerationOptions
): Promise<Buffer> {
  const { width, height, cellSize = 1, showElevation = false, showBiomes = true, showRivers = true, showLakes = true } = options;
  const imageWidth = width * cellSize;
  const imageHeight = height * cellSize;
  
  // Create RGBA buffer
  const buffer = Buffer.alloc(imageWidth * imageHeight * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = map[y][x];
      let color: [number, number, number, number]; // RGBA
      
      if (showBiomes && tile.biome) {
        // Use biome colors with elevation shading
        const baseColor = BIOME_COLORS[tile.biome as BiomeType] || [128, 128, 128]; // Fallback gray
        const shadedColor = applyElevationShading(baseColor, tile.elevation);
        let finalColor = shadedColor;
        
        // Apply lake overlay first (lakes are larger water bodies)
        if (showLakes && tile.lake) {
          finalColor = applyLakeOverlay(finalColor, tile.lake);
        }
        
        // Apply river overlay second (rivers flow through and connect to lakes)
        if (showRivers) {
          finalColor = applyRiverOverlay(finalColor, tile.river);
        }
        
        color = [finalColor[0], finalColor[1], finalColor[2], 255];
      } else if (showElevation) {
        // Legacy elevation-based coloring
        const elevation = tile.elevation;
        let baseColor: [number, number, number];
        if (tile.type === 'ocean') {
          // Ocean: dark blue to light blue based on depth
          const blue = Math.floor(30 + elevation * 100);
          baseColor = [0, 20, blue];
        } else {
          // Land: green to brown to white based on elevation
          if (elevation < 0.4) {
            // Low land - green
            const green = Math.floor(100 + elevation * 300);
            baseColor = [50, green, 50];
          } else if (elevation < 0.7) {
            // Medium elevation - brown
            const brown = Math.floor(elevation * 255);
            baseColor = [brown, brown * 0.6, brown * 0.3];
          } else {
            // High elevation - white (snow/ice)
            const white = Math.floor(200 + elevation * 55);
            baseColor = [white, white, white];
          }
        }
        let finalColor = baseColor;
        
        // Apply lake overlay first (lakes are larger water bodies)
        if (showLakes && tile.lake) {
          finalColor = applyLakeOverlay(finalColor, tile.lake);
        }
        
        // Apply river overlay second (rivers flow through and connect to lakes)
        if (showRivers) {
          finalColor = applyRiverOverlay(finalColor, tile.river);
        }
        
        color = [finalColor[0], finalColor[1], finalColor[2], 255];
      } else {
        // Simple tile type coloring (fallback)
        let baseColor: [number, number, number];
        if (tile.type === 'ocean') {
          baseColor = [30, 144, 255]; // Dodger blue
        } else {
          baseColor = [34, 139, 34]; // Forest green
        }
        
        let finalColor = baseColor;
        
        // Apply lake overlay first (lakes are larger water bodies)
        if (showLakes && tile.lake) {
          finalColor = applyLakeOverlay(finalColor, tile.lake);
        }
        
        // Apply river overlay second (rivers flow through and connect to lakes)
        if (showRivers) {
          finalColor = applyRiverOverlay(finalColor, tile.river);
        }
        
        color = [finalColor[0], finalColor[1], finalColor[2], 255];
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
  
  // Create PNG using Sharp
  return await sharp(buffer, {
    raw: {
      width: imageWidth,
      height: imageHeight,
      channels: 4
    }
  }).png().toBuffer();
}

/**
 * Save a map as PNG file
 */
export async function saveMapPng(
  map: Tile[][],
  filepath: string,
  options: PngGenerationOptions
): Promise<void> {
  const pngBuffer = await generateMapPng(map, options);
  const fs = await import('fs/promises');
  await fs.writeFile(filepath, pngBuffer);
}

/**
 * Generate a color legend for map visualization
 */
export async function generateLegend(showElevation: boolean = false, showBiomes: boolean = true): Promise<Buffer> {
  const width = 300;
  const height = showBiomes ? 400 : (showElevation ? 300 : 100);
  const buffer = Buffer.alloc(width * height * 4);
  
  if (showBiomes) {
    // Biome legend with elevation shading examples
    const biomes = Object.keys(BIOME_COLORS) as BiomeType[];
    const biomeHeight = Math.floor(height / biomes.length);
    
    biomes.forEach((biome, index) => {
      const startY = index * biomeHeight;
      const endY = Math.min(startY + biomeHeight, height);
      
      for (let y = startY; y < endY; y++) {
        // Show elevation gradient within each biome section
        const progress = (y - startY) / biomeHeight;
        const elevation = progress; // 0 to 1 across the height
        
        const baseColor = BIOME_COLORS[biome];
        const shadedColor = applyElevationShading(baseColor, elevation);
        
        for (let x = 0; x < width; x++) {
          const pixelIndex = (y * width + x) * 4;
          buffer[pixelIndex] = shadedColor[0];
          buffer[pixelIndex + 1] = shadedColor[1];
          buffer[pixelIndex + 2] = shadedColor[2];
          buffer[pixelIndex + 3] = 255;
        }
      }
    });
  } else if (showElevation) {
    // Legacy elevation legend
    for (let y = 0; y < height; y++) {
      const elevation = 1 - (y / height); // Top = high elevation
      let color: [number, number, number, number];
      
      if (elevation < 0.3) {
        // Ocean
        const blue = Math.floor(30 + elevation * 100);
        color = [0, 20, blue, 255];
      } else if (elevation < 0.4) {
        // Low land - green  
        const green = Math.floor(100 + elevation * 300);
        color = [50, green, 50, 255];
      } else if (elevation < 0.7) {
        // Medium elevation - brown
        const brown = Math.floor(elevation * 255);
        color = [brown, brown * 0.6, brown * 0.3, 255];
      } else {
        // High elevation - white
        const white = Math.floor(200 + elevation * 55);
        color = [white, white, white, 255];
      }
      
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        buffer[pixelIndex] = color[0];
        buffer[pixelIndex + 1] = color[1];
        buffer[pixelIndex + 2] = color[2];
        buffer[pixelIndex + 3] = color[3];
      }
    }
  } else {
    // Simple tile type legend
    for (let y = 0; y < height; y++) {
      const color = y < height / 2 ? [30, 144, 255, 255] : [34, 139, 34, 255];
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        buffer[pixelIndex] = color[0];
        buffer[pixelIndex + 1] = color[1];
        buffer[pixelIndex + 2] = color[2];
        buffer[pixelIndex + 3] = color[3];
      }
    }
  }
  
  return await sharp(buffer, {
    raw: {
      width: width,
      height: height,
      channels: 4
    }
  }).png().toBuffer();
}