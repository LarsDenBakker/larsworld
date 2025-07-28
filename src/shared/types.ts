/**
 * Shared types between server and client for map generation API
 */

// Biome types as compact numeric indices instead of verbose strings
export const BIOME_TYPES = [
  'ocean',
  'shallow_water', 
  'beach',
  'desert',
  'grassland',
  'forest',
  'tundra',
  'mountain',
  'snow',
  'swamp',
  'river',
  'lake'
] as const;

export type BiomeType = typeof BIOME_TYPES[number];
export type BiomeIndex = number; // 0-9 index into BIOME_TYPES array

// Compact tile representation for API responses
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

// Full tile representation used internally
export interface Tile {
  type: BiomeType;
  x: number;
  y: number;
  elevation: number; // 0-1, where 0 is sea level
  temperature: number; // 0-1, where 0 is coldest, 1 is hottest
  moisture: number; // 0-1, where 0 is driest, 1 is wettest
}

// API request parameters for paginated map generation
export interface MapPageRequest {
  page: number;
  pageSize: number;
  seed: string;
  width?: number;
  height?: number;
}

// API response for a single page of map data
export interface MapPageResponse {
  page: number;
  pageSize: number;
  totalPages: number;
  seed: string;
  startY: number;
  endY: number;
  tiles: CompactTile[][];
  sizeBytes: number;
}

// Error response format
export interface ApiError {
  error: string;
  details?: string;
}

/**
 * Convert a full Tile to compact representation
 */
export function tileToCompact(tile: Tile): CompactTile {
  const biomeIndex = BIOME_TYPES.indexOf(tile.type);
  if (biomeIndex === -1) {
    throw new Error(`Unknown biome type: ${tile.type}`);
  }
  
  return {
    b: biomeIndex,
    e: Math.round(tile.elevation * 255),
    t: Math.round(tile.temperature * 255),
    m: Math.round(tile.moisture * 255)
  };
}

/**
 * Convert compact representation back to full Tile
 */
export function compactToTile(compact: CompactTile, x: number, y: number): Tile {
  return {
    type: BIOME_TYPES[compact.b],
    x,
    y,
    elevation: compact.e / 255,
    temperature: compact.t / 255,
    moisture: compact.m / 255
  };
}

/**
 * Estimate JSON size of a compact tile array
 */
export function estimatePayloadSize(tiles: CompactTile[][]): number {
  // Rough estimation: each compact tile is ~20-25 bytes when JSON stringified
  const tileCount = tiles.reduce((sum, row) => sum + row.length, 0);
  return tileCount * 25; // Conservative estimate
}