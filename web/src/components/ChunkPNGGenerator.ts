/**
 * Frontend PNG chunk generator
 * Creates PNG images for chunks to replace individual DOM tiles
 */

interface ChunkData {
  [key: number]: {
    biome: string
    elevation: number
  }
}

type BiomeKey = 'deep_ocean' | 'shallow_ocean' | 'desert' | 'tundra' | 'arctic' | 'swamp' | 
               'grassland' | 'forest' | 'taiga' | 'savanna' | 'tropical_forest' | 'alpine'

const BIOME_COLORS: Record<BiomeKey, [number, number, number]> = {
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
}

/**
 * Apply elevation-based darkening to a color
 */
function applyElevationShading(baseColor: [number, number, number], elevation: number): [number, number, number] {
  const darkeningFactor = 1 - (elevation * 0.4); // Reduce up to 40% brightness at max elevation
  return [
    Math.floor(baseColor[0] * darkeningFactor),
    Math.floor(baseColor[1] * darkeningFactor),
    Math.floor(baseColor[2] * darkeningFactor)
  ];
}

/**
 * Generate a PNG data URL for a chunk using Canvas API
 */
export function generateChunkPNG(chunkData: ChunkData, chunkSize: number = 16, tileSize: number = 6): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Unable to create canvas context');
  }
  
  const imageSize = chunkSize * tileSize;
  canvas.width = imageSize;
  canvas.height = imageSize;
  
  // Clear canvas with transparent background
  ctx.clearRect(0, 0, imageSize, imageSize);
  
  // Render each tile
  for (let tileIndex = 0; tileIndex < chunkSize * chunkSize; tileIndex++) {
    const tile = chunkData[tileIndex];
    if (!tile) continue;
    
    const localY = Math.floor(tileIndex / chunkSize);
    const localX = tileIndex % chunkSize;
    
    // Get biome color with elevation shading
    const baseColor = BIOME_COLORS[tile.biome as BiomeKey] || [128, 128, 128];
    const shadedColor = applyElevationShading(baseColor, tile.elevation);
    
    // Set fill color
    ctx.fillStyle = `rgb(${shadedColor[0]}, ${shadedColor[1]}, ${shadedColor[2]})`;
    
    // Draw tile rectangle
    const pixelX = localX * tileSize;
    const pixelY = localY * tileSize;
    ctx.fillRect(pixelX, pixelY, tileSize, tileSize);
  }
  
  // Convert to data URL
  return canvas.toDataURL('image/png');
}

/**
 * Generate PNG for multiple chunks with batching to avoid UI freezing
 */
export async function generateChunkPNGsBatch(
  chunksData: Map<string, ChunkData>,
  chunkSize: number = 16,
  tileSize: number = 6,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const chunks = Array.from(chunksData.entries());
  const batchSize = 10; // Process 10 chunks per batch to keep UI responsive
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    // Process batch synchronously (it's fast enough for 10 chunks)
    for (const [chunkKey, chunkData] of batch) {
      try {
        const pngDataUrl = generateChunkPNG(chunkData, chunkSize, tileSize);
        result.set(chunkKey, pngDataUrl);
      } catch (error) {
        console.error(`Failed to generate PNG for chunk ${chunkKey}:`, error);
      }
    }
    
    // Report progress and yield to browser
    if (onProgress) {
      onProgress(Math.min(i + batchSize, chunks.length), chunks.length);
    }
    
    // Yield control to browser to keep UI responsive
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return result;
}

/**
 * Get tile coordinates from click position on chunk image
 */
export function getTileFromImageClick(
  clickX: number, 
  clickY: number, 
  chunkSize: number = 16, 
  tileSize: number = 6
): { localX: number, localY: number } {
  const localX = Math.floor(clickX / tileSize);
  const localY = Math.floor(clickY / tileSize);
  
  return {
    localX: Math.max(0, Math.min(localX, chunkSize - 1)),
    localY: Math.max(0, Math.min(localY, chunkSize - 1))
  };
}

/**
 * Get tile data from chunk data using local coordinates
 */
export function getTileData(
  chunkData: ChunkData,
  localX: number,
  localY: number,
  chunkSize: number = 16
): { biome: string; elevation: number } | null {
  const tileIndex = localY * chunkSize + localX;
  return chunkData[tileIndex] || null;
}