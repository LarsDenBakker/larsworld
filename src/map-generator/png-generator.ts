/**
 * PNG generation utility for world maps
 * Converts map tiles to PNG images for visualization
 */
import sharp from 'sharp';
import { Tile } from './index.js';

export interface PngGenerationOptions {
  width: number;
  height: number;
  cellSize?: number; // Size of each tile in pixels
  showElevation?: boolean; // Whether to color by elevation
}

/**
 * Generate a PNG image from a map of tiles
 */
export async function generateMapPng(
  map: Tile[][],
  options: PngGenerationOptions
): Promise<Buffer> {
  const { width, height, cellSize = 1, showElevation = false } = options;
  const imageWidth = width * cellSize;
  const imageHeight = height * cellSize;
  
  // Create RGBA buffer
  const buffer = Buffer.alloc(imageWidth * imageHeight * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = map[y][x];
      let color: [number, number, number, number]; // RGBA
      
      if (showElevation) {
        // Elevation-based coloring
        const elevation = tile.elevation;
        if (tile.type === 'ocean') {
          // Ocean: dark blue to light blue based on depth
          const blue = Math.floor(30 + elevation * 100);
          color = [0, 20, blue, 255];
        } else {
          // Land: green to brown to white based on elevation
          if (elevation < 0.4) {
            // Low land - green
            const green = Math.floor(100 + elevation * 300);
            color = [50, green, 50, 255];
          } else if (elevation < 0.7) {
            // Medium elevation - brown
            const brown = Math.floor(elevation * 255);
            color = [brown, brown * 0.6, brown * 0.3, 255];
          } else {
            // High elevation - white (snow/ice)
            const white = Math.floor(200 + elevation * 55);
            color = [white, white, white, 255];
          }
        }
      } else {
        // Simple tile type coloring
        if (tile.type === 'ocean') {
          color = [30, 144, 255, 255]; // Dodger blue
        } else {
          color = [34, 139, 34, 255]; // Forest green
        }
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
export async function generateLegend(showElevation: boolean = false): Promise<Buffer> {
  const width = 200;
  const height = showElevation ? 300 : 100;
  const buffer = Buffer.alloc(width * height * 4);
  
  if (showElevation) {
    // Elevation legend
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