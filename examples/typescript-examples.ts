/**
 * TypeScript Examples for Paginated Map Generation API
 * Demonstrates the complete implementation with shared types and usage patterns
 */

// =====================================================================
// SHARED TYPES (src/shared/types.ts)
// =====================================================================

/** Biome types as compact numeric indices instead of verbose strings */
export const BIOME_TYPES = [
  'ocean', 'shallow_water', 'beach', 'desert', 'grassland',
  'forest', 'tundra', 'mountain', 'snow', 'swamp'
] as const;

export type BiomeType = typeof BIOME_TYPES[number];
export type BiomeIndex = number; // 0-9 index into BIOME_TYPES array

/** Compact tile representation for API responses (minimized JSON) */
export interface CompactTile {
  /** Biome type index (0-9) */
  b: BiomeIndex;
  /** Elevation (0-255, scaled from 0-1) */
  e: number;
  /** Temperature (0-255, scaled from 0-1) */
  t: number;
  /** Moisture (0-255, scaled from 0-1) */
  m: number;
}

/** API request parameters for paginated map generation */
export interface MapPageRequest {
  page: number;
  pageSize: number;
  width: number;
  height: number;
  seed: string;
}

/** API response for a single page of map data */
export interface MapPageResponse {
  page: number;
  pageSize: number;
  totalPages: number;
  width: number;
  height: number;
  seed: string;
  startY: number;
  endY: number;
  tiles: CompactTile[][];
  sizeBytes: number;
}

// =====================================================================
// SERVER-SIDE IMPLEMENTATION (Next.js API Handler Style)
// =====================================================================

import { NextApiRequest, NextApiResponse } from 'next';
import { generateMapPage, validateMapPageRequest } from '../map-generator/paginated';
import { ApiError } from '../shared/types';

/**
 * Next.js API handler for paginated map generation
 * GET /api/map?page=0&pageSize=64&width=256&height=256&seed=abc
 */
export default function handler(req: NextApiRequest, res: NextApiResponse<MapPageResponse | ApiError>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse and validate query parameters
    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 64;
    const width = parseInt(req.query.width as string) || 256;
    const height = parseInt(req.query.height as string) || 256;
    const seed = req.query.seed as string || 'default';

    const request: MapPageRequest = { page, pageSize, width, height, seed };

    // Validate request parameters
    validateMapPageRequest(request);

    // Generate the requested page using stateless, deterministic generator
    const startTime = Date.now();
    const response = generateMapPage(request);
    const duration = Date.now() - startTime;

    console.log(`Generated page ${page} in ${duration}ms, size: ${Math.round(response.sizeBytes / 1024)}KB`);

    // Ensure payload doesn't exceed 6MB Netlify limit
    if (response.sizeBytes > 6 * 1024 * 1024) {
      return res.status(413).json({
        error: 'Payload too large',
        details: `Generated ${Math.round(response.sizeBytes / 1024 / 1024 * 100) / 100}MB, exceeds 6MB limit`
      });
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Map generation error:', error);
    const apiError: ApiError = {
      error: 'Map generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(400).json(apiError);
  }
}

// =====================================================================
// CLIENT-SIDE IMPLEMENTATION
// =====================================================================

interface MapGenerationConfig {
  width: number;
  height: number;
  seed: string;
  pageSize: number;
  baseUrl?: string;
  onProgress?: (page: number, totalPages: number) => void;
  onPageReceived?: (response: MapPageResponse) => void;
  onComplete?: (totalPages: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Fetch a single page of map data from the paginated API
 */
async function fetchMapPage(
  page: number,
  pageSize: number,
  width: number,
  height: number,
  seed: string,
  baseUrl: string = '/api'
): Promise<MapPageResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    width: width.toString(),
    height: height.toString(),
    seed: seed
  });

  const response = await fetch(`${baseUrl}/map?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Generate a complete map using sequential page requests
 * Provides streaming-like experience without SSE
 */
export async function generatePaginatedMap(config: MapGenerationConfig): Promise<CompactTile[][]> {
  const { width, height, seed, pageSize, baseUrl = '/api', onProgress, onPageReceived, onComplete, onError } = config;

  try {
    // Fetch first page to determine total pages and validate parameters
    const firstPage = await fetchMapPage(0, pageSize, width, height, seed, baseUrl);
    const totalPages = firstPage.totalPages;

    console.log(`Generating ${width}×${height} map in ${totalPages} pages`);

    // Initialize result array
    const mapData: CompactTile[][] = new Array(height);

    // Process first page
    for (let i = 0; i < firstPage.tiles.length; i++) {
      mapData[firstPage.startY + i] = firstPage.tiles[i];
    }
    onPageReceived?.(firstPage);

    let pagesComplete = 1;
    onProgress?.(pagesComplete, totalPages);

    // Fetch remaining pages sequentially
    for (let page = 1; page < totalPages; page++) {
      const pageResponse = await fetchMapPage(page, pageSize, width, height, seed, baseUrl);
      
      // Store page data
      for (let i = 0; i < pageResponse.tiles.length; i++) {
        mapData[pageResponse.startY + i] = pageResponse.tiles[i];
      }
      
      onPageReceived?.(pageResponse);
      pagesComplete++;
      onProgress?.(pagesComplete, totalPages);

      // Small delay to allow UI updates (streaming-like experience)
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    onComplete?.(totalPages);
    return mapData;

  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    onError?.(err);
    throw err;
  }
}

// =====================================================================
// USAGE EXAMPLES
// =====================================================================

/**
 * Example 1: Basic map generation
 */
export async function basicExample() {
  const config: MapGenerationConfig = {
    width: 256,
    height: 256,
    seed: 'example-world-123',
    pageSize: 64,
    onProgress: (page, total) => console.log(`Progress: ${page}/${total}`),
    onComplete: (total) => console.log(`Generated ${total} pages successfully`)
  };

  const mapData = await generatePaginatedMap(config);
  console.log(`Generated map: ${mapData.length}×${mapData[0].length} tiles`);
}

/**
 * Example 2: Large map with error handling
 */
export async function largeMapExample() {
  try {
    const config: MapGenerationConfig = {
      width: 1024,
      height: 1024,
      seed: 'large-procedural-world',
      pageSize: 32, // Smaller pages for large maps
      onProgress: (page, total) => {
        const progress = (page / total) * 100;
        console.log(`Generating... ${progress.toFixed(1)}%`);
      },
      onError: (error) => console.error('Generation failed:', error.message)
    };

    const mapData = await generatePaginatedMap(config);
    
    // Convert compact tiles back to full format for processing
    const fullMap = mapData.map((row, y) => 
      row.map((compactTile, x) => compactToTile(compactTile, x, y))
    );

    console.log('Large map generated successfully');
    return fullMap;

  } catch (error) {
    console.error('Failed to generate large map:', error);
    throw error;
  }
}

/**
 * Example 3: Real-time rendering during generation
 */
export async function streamingRenderExample(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const config: MapGenerationConfig = {
    width: 512,
    height: 512,
    seed: 'streaming-demo',
    pageSize: 64,
    onPageReceived: (response) => {
      // Render each page as it arrives for streaming effect
      renderMapPage(ctx, response);
    }
  };

  await generatePaginatedMap(config);
}

function renderMapPage(ctx: CanvasRenderingContext2D, response: MapPageResponse) {
  const { tiles, startY } = response;
  const BIOME_COLORS = {
    ocean: '#1e40af', shallow_water: '#3b82f6', beach: '#fbbf24',
    desert: '#f59e0b', grassland: '#22c55e', forest: '#16a34a',
    tundra: '#f3f4f6', mountain: '#6b7280', snow: '#ffffff', swamp: '#059669'
  };

  tiles.forEach((row, rowIndex) => {
    const y = startY + rowIndex;
    row.forEach((compactTile, x) => {
      const tile = compactToTile(compactTile, x, y);
      const color = BIOME_COLORS[tile.type] || '#888888';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

/**
 * Convert compact tile format back to full tile representation
 */
function compactToTile(compact: CompactTile, x: number, y: number): Tile {
  return {
    type: BIOME_TYPES[compact.b],
    x, y,
    elevation: compact.e / 255,
    temperature: compact.t / 255,
    moisture: compact.m / 255
  };
}

/**
 * Calculate optimal page size to stay under size limit
 */
export function calculateOptimalPageSize(width: number, maxSizeBytes: number = 6 * 1024 * 1024): number {
  const bytesPerTile = 25; // Estimated bytes per compact tile in JSON
  const maxTiles = Math.floor((maxSizeBytes - 1000) / bytesPerTile); // Reserve 1KB for metadata
  const maxRows = Math.floor(maxTiles / width);
  return Math.max(1, Math.min(maxRows, 256)); // Reasonable limits
}

/**
 * Estimate total payload size for a map configuration
 */
export function estimateMapSize(width: number, height: number, pageSize: number): {
  totalPages: number;
  estimatedPageSize: number;
  totalSize: number;
  isUnderLimit: boolean;
} {
  const totalPages = Math.ceil(height / pageSize);
  const tilesPerPage = width * pageSize;
  const estimatedPageSize = tilesPerPage * 25; // ~25 bytes per tile
  const totalSize = totalPages * estimatedPageSize;
  const isUnderLimit = estimatedPageSize < 6 * 1024 * 1024;

  return { totalPages, estimatedPageSize, totalSize, isUnderLimit };
}

// =====================================================================
// API ENDPOINT EXAMPLES
// =====================================================================

/**
 * Example API calls demonstrating the pagination protocol:
 * 
 * GET /api/map?page=0&pageSize=64&width=256&height=256&seed=abc
 * Response: {
 *   "page": 0,
 *   "pageSize": 64,
 *   "totalPages": 4,
 *   "width": 256,
 *   "height": 256,
 *   "seed": "abc",
 *   "startY": 0,
 *   "endY": 64,
 *   "tiles": [[{b:1,e:45,t:128,m:200}, ...], ...],
 *   "sizeBytes": 487234
 * }
 * 
 * GET /api/map?page=1&pageSize=64&width=256&height=256&seed=abc
 * Response: {
 *   "page": 1,
 *   "pageSize": 64,
 *   "totalPages": 4,
 *   "startY": 64,
 *   "endY": 128,
 *   ...
 * }
 */