/**
 * Client-side chunk-based map generation
 * Fetches map data in 16x16 chunks and renders them as they arrive
 * Supports unlimited map growth in any direction
 */

// Import shared types
import { MapChunkResponse, CompactTile, TILE_TYPES, compactToTile, CHUNK_SIZE } from '../shared/types.js';

interface ChunkMapConfig {
  seed: string;
  centerChunkX?: number; // Central chunk X coordinate (default: 0)
  centerChunkY?: number; // Central chunk Y coordinate (default: 0)
  viewRadius?: number;   // Number of chunks to load in each direction (default: 3 for 7x7 chunk area)
  maxConcurrentRequests?: number; // Max parallel requests (default: 5)
  maxPayloadSize?: number; // Max total payload size in bytes (default: 6MB)
  onProgress?: (loaded: number, total: number) => void;
  onChunkReceived?: (response: MapChunkResponse) => void;
  onComplete?: (totalChunks: number) => void;
  onError?: (error: Error) => void;
}

interface ChunkMapRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tileSize: number;
  centerX: number;
  centerY: number;
  viewRadius: number;
}

/**
 * Biome color mapping for rendering
 */
const BIOME_COLORS: Record<string, string> = {
  ocean: '#1e40af',
  shallow_ocean: '#3b82f6',
  deep_ocean: '#1e3a8a',
  desert: '#f59e0b',
  grassland: '#22c55e',
  forest: '#16a34a',
  tundra: '#f3f4f6',
  alpine: '#6b7280',
  arctic: '#ffffff',
  swamp: '#059669',
  savanna: '#eab308',
  tropical_forest: '#15803d',
  taiga: '#374151'
};

/**
 * Fetch a single chunk from the API
 */
async function fetchChunk(chunkX: number, chunkY: number, seed: string): Promise<MapChunkResponse> {
  const params = new URLSearchParams({
    chunkX: chunkX.toString(),
    chunkY: chunkY.toString(),
    seed: seed
  });

  const response = await fetch(`/api/chunk?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Create a canvas renderer for chunk-based maps
 */
function createChunkMapRenderer(
  centerChunkX: number, 
  centerChunkY: number, 
  viewRadius: number, 
  container: HTMLElement
): ChunkMapRenderer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Calculate total map size in tiles
  const chunksPerSide = (viewRadius * 2) + 1;
  const tilesPerSide = chunksPerSide * CHUNK_SIZE;
  
  // Calculate tile size to fit in container (max 800px)
  const maxSize = 800;
  const tileSize = Math.max(1, Math.floor(maxSize / tilesPerSide));

  canvas.width = tilesPerSide * tileSize;
  canvas.height = tilesPerSide * tileSize;
  canvas.style.border = '1px solid #ccc';
  canvas.style.imageRendering = 'pixelated';

  container.appendChild(canvas);

  return { 
    canvas, 
    ctx, 
    tileSize, 
    centerX: centerChunkX,
    centerY: centerChunkY,
    viewRadius 
  };
}

/**
 * Render a chunk to the canvas at the correct position
 */
function renderChunk(renderer: ChunkMapRenderer, response: MapChunkResponse): void {
  const { ctx, tileSize, centerX, centerY, viewRadius } = renderer;
  const { chunkX, chunkY, tiles } = response;

  // Calculate offset from center chunk
  const chunkOffsetX = chunkX - centerX;
  const chunkOffsetY = chunkY - centerY;
  
  // Skip chunks outside our view area
  if (Math.abs(chunkOffsetX) > viewRadius || Math.abs(chunkOffsetY) > viewRadius) {
    return;
  }

  // Calculate canvas coordinates for this chunk
  const canvasChunkX = chunkOffsetX + viewRadius;
  const canvasChunkY = chunkOffsetY + viewRadius;
  const canvasStartX = canvasChunkX * CHUNK_SIZE * tileSize;
  const canvasStartY = canvasChunkY * CHUNK_SIZE * tileSize;

  // Render each tile in the chunk
  tiles.forEach((row, localY) => {
    row.forEach((compactTile, localX) => {
      const worldX = chunkX * CHUNK_SIZE + localX;
      const worldY = chunkY * CHUNK_SIZE + localY;
      const tile = compactToTile(compactTile, worldX, worldY);
      
      const color = BIOME_COLORS[tile.type] || '#888888';
      
      ctx.fillStyle = color;
      ctx.fillRect(
        canvasStartX + localX * tileSize,
        canvasStartY + localY * tileSize,
        tileSize,
        tileSize
      );
    });
  });
}

/**
 * Generate all chunks needed for the specified area
 */
function generateChunkList(centerX: number, centerY: number, radius: number): Array<{x: number, y: number}> {
  const chunks = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      chunks.push({
        x: centerX + dx,
        y: centerY + dy
      });
    }
  }
  return chunks;
}

/**
 * Generate and render a chunk-based map
 */
export async function generateChunkBasedMap(config: ChunkMapConfig, container: HTMLElement): Promise<void> {
  const { 
    seed, 
    centerChunkX = 0, 
    centerChunkY = 0, 
    viewRadius = 3,
    maxConcurrentRequests = 5,
    maxPayloadSize = 6 * 1024 * 1024, // 6MB
    onProgress, 
    onChunkReceived, 
    onComplete, 
    onError 
  } = config;

  try {
    // Clear container
    container.innerHTML = '';

    // Calculate chunks needed
    const chunkList = generateChunkList(centerChunkX, centerChunkY, viewRadius);
    const totalChunks = chunkList.length;

    console.log(`Generating chunk-based map: ${totalChunks} chunks (${viewRadius*2+1}x${viewRadius*2+1} chunk area)`);

    // Create progress indicator
    const progressContainer = document.createElement('div');
    progressContainer.style.marginBottom = '20px';
    progressContainer.innerHTML = `
      <div style="background: #f3f4f6; border-radius: 4px; padding: 15px;">
        <div style="margin-bottom: 10px; font-weight: bold;">Generating Chunk-Based Map...</div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;">
          <div id="progress-bar" style="background: #3b82f6; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
        <div id="progress-text" style="margin-top: 10px; font-size: 14px; color: #6b7280;">Initializing...</div>
      </div>
    `;
    container.appendChild(progressContainer);

    const progressBar = progressContainer.querySelector('#progress-bar') as HTMLElement;
    const progressText = progressContainer.querySelector('#progress-text') as HTMLElement;

    // Create renderer
    const renderer = createChunkMapRenderer(centerChunkX, centerChunkY, viewRadius, container);

    let chunksLoaded = 0;
    let totalPayloadSize = 0;

    const updateProgress = () => {
      const progress = (chunksLoaded / totalChunks) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `Chunk ${chunksLoaded} of ${totalChunks} (${Math.round(progress)}%) - ${Math.round(totalPayloadSize / 1024)}KB total`;
      onProgress?.(chunksLoaded, totalChunks);
    };

    // Function to process a batch of chunks
    const processBatch = async (batchChunks: Array<{x: number, y: number}>) => {
      const promises = batchChunks.map(async (chunk) => {
        try {
          progressText.textContent = `Fetching chunk (${chunk.x}, ${chunk.y})...`;
          
          const response = await fetchChunk(chunk.x, chunk.y, seed);
          
          // Check payload size limit
          if (totalPayloadSize + response.sizeBytes > maxPayloadSize) {
            console.warn(`Payload size limit reached. Skipping remaining chunks.`);
            return null;
          }
          
          totalPayloadSize += response.sizeBytes;
          
          // Render chunk
          renderChunk(renderer, response);
          onChunkReceived?.(response);
          
          chunksLoaded++;
          updateProgress();
          
          return response;
        } catch (error) {
          console.error(`Failed to fetch chunk (${chunk.x}, ${chunk.y}):`, error);
          throw error;
        }
      });

      return Promise.all(promises);
    };

    // Process chunks in batches to respect concurrency limit
    for (let i = 0; i < chunkList.length; i += maxConcurrentRequests) {
      const batch = chunkList.slice(i, i + maxConcurrentRequests);
      
      if (totalPayloadSize >= maxPayloadSize) {
        console.log('Payload size limit reached. Stopping chunk loading.');
        break;
      }
      
      await processBatch(batch);
    }

    // Remove progress indicator
    progressContainer.remove();

    // Add completion info
    const infoContainer = document.createElement('div');
    infoContainer.style.marginBottom = '10px';
    infoContainer.innerHTML = `
      <div style="font-size: 14px; color: #6b7280;">
        Chunk-based map generated: ${chunksLoaded}/${totalChunks} chunks, 
        center: (${centerChunkX}, ${centerChunkY}), 
        radius: ${viewRadius}, 
        seed: "${seed}", 
        total: ${Math.round(totalPayloadSize / 1024)}KB
      </div>
    `;
    container.insertBefore(infoContainer, renderer.canvas);

    onComplete?.(chunksLoaded);

  } catch (error) {
    console.error('Chunk-based map generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    container.innerHTML = `<p style="color: red;">Failed to generate chunk-based map: ${errorMessage}</p>`;
    onError?.(error as Error);
  }
}

/**
 * Calculate chunk area information
 */
export function calculateChunkArea(viewRadius: number): {
  chunksPerSide: number;
  totalChunks: number;
  tilesPerSide: number;
  totalTiles: number;
  estimatedSize: number;
} {
  const chunksPerSide = (viewRadius * 2) + 1;
  const totalChunks = chunksPerSide * chunksPerSide;
  const tilesPerSide = chunksPerSide * CHUNK_SIZE;
  const totalTiles = tilesPerSide * tilesPerSide;
  const estimatedSize = totalChunks * 9600; // ~9.6KB per chunk

  return {
    chunksPerSide,
    totalChunks,
    tilesPerSide,
    totalTiles,
    estimatedSize
  };
}

/**
 * Example usage and API demonstration
 */
export function demonstrateChunkBasedMapAPI() {
  console.log('=== Chunk-Based Map API Examples ===');
  
  // Example 1: Small area around origin
  const smallAreaInfo = calculateChunkArea(2);
  console.log('Small Area (5x5 chunks):', {
    config: { centerChunkX: 0, centerChunkY: 0, viewRadius: 2 },
    area: smallAreaInfo,
    url: '/api/chunk?chunkX=0&chunkY=0&seed=example-seed'
  });

  // Example 2: Medium area
  const mediumAreaInfo = calculateChunkArea(5);
  console.log('Medium Area (11x11 chunks):', {
    config: { centerChunkX: 10, centerChunkY: -5, viewRadius: 5 },
    area: mediumAreaInfo,
    url: '/api/chunk?chunkX=10&chunkY=-5&seed=example-seed'
  });

  // Example 3: Maximum area within 6MB limit
  let maxRadius = 1;
  while (calculateChunkArea(maxRadius + 1).estimatedSize <= 6 * 1024 * 1024) {
    maxRadius++;
  }
  
  const maxAreaInfo = calculateChunkArea(maxRadius);
  console.log(`Maximum Area within 6MB (${maxAreaInfo.chunksPerSide}x${maxAreaInfo.chunksPerSide} chunks):`, {
    config: { viewRadius: maxRadius },
    area: maxAreaInfo
  });
}