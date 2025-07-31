/**
 * Shared types between server and client for map generation API
 */

// Tile types as per specs - only land and ocean
export const TILE_TYPES = [
  'ocean',
  'land'
] as const;

export type TileType = typeof TILE_TYPES[number];

// Elevation categories for enhanced visualization
export const ELEVATION_TYPES = [
  'flat',      // 0.0-0.4: Lowlands, plains, valleys
  'hills',     // 0.4-0.7: Rolling hills, plateaus
  'mountains'  // 0.7-1.0: High mountains, peaks
] as const;

export type ElevationType = typeof ELEVATION_TYPES[number];

// Biome types for enhanced world generation
export const BIOME_TYPES = [
  'deep_ocean',      // Deep water
  'shallow_ocean',   // Coastal water
  'desert',          // Hot, dry land
  'tundra',          // Cold, dry land
  'arctic',          // Very cold land
  'swamp',           // Warm, wet lowland
  'grassland',       // Temperate, moderate moisture
  'forest',          // Temperate, wet
  'taiga',           // Cold forest
  'savanna',         // Hot, seasonal moisture
  'tropical_forest', // Hot, very wet
  'alpine'           // High elevation, cold
] as const;

export type BiomeType = typeof BIOME_TYPES[number];
export type TileIndex = number; // 0-1 index into TILE_TYPES array

// River segment types for realistic river networks
export const RIVER_TYPES = [
  'none',      // No river segment
  'horizontal', // Horizontal river segment (west-east)
  'vertical',   // Vertical river segment (north-south)
  'bend_ne',    // Bend from north to east
  'bend_nw',    // Bend from north to west
  'bend_se',    // Bend from south to east
  'bend_sw',    // Bend from south to west
  'bend_en',    // Bend from east to north
  'bend_es',    // Bend from east to south
  'bend_wn',    // Bend from west to north
  'bend_ws'     // Bend from west to south
] as const;

export type RiverType = typeof RIVER_TYPES[number];
export type RiverIndex = number; // 0-10 index into RIVER_TYPES array

// Compact tile representation for API responses
export interface CompactTile {
  /** Tile type index (0-1) */
  t: TileIndex;
  /** Elevation (0-255, scaled from 0-1) */
  e: number;
  /** Temperature (0-255, scaled from 0-1) */
  tmp: number;
  /** Moisture (0-255, scaled from 0-1) */
  m: number;
  /** Biome type index */
  b: number;
  /** River type index (0-10) */
  r: RiverIndex;
  /** Lake flag (0=no lake, 1=has lake) */
  l: number;
}

// Full tile representation used internally
export interface Tile {
  type: TileType;
  x: number;
  y: number;
  elevation: number; // 0-1, where 0 is sea level
  temperature: number; // 0-1, where 0 is coldest, 1 is hottest
  moisture: number; // 0-1, where 0 is driest, 1 is wettest
  biome: BiomeType; // Calculated biome based on elevation, temperature, moisture
  elevationType: ElevationType; // Calculated elevation category
  river: RiverType; // River segment type at this tile
  lake: boolean; // Whether this tile contains a lake
}

// API request parameters for paginated map generation (legacy)
export interface MapPageRequest {
  page: number;
  pageSize: number;
  seed: string;
}

// API response for a single page of map data (legacy)
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

// Chunk size constant - each chunk is 16x16 tiles
export const CHUNK_SIZE = 16;

// API request parameters for chunk-based map generation
export interface MapChunkRequest {
  chunkX: number;
  chunkY: number;
  seed: string;
}

// API response for a single chunk of map data
export interface MapChunkResponse {
  chunkX: number;
  chunkY: number;
  seed: string;
  tiles: CompactTile[][];
  sizeBytes: number;
}

// Error response format
export interface ApiError {
  error: string;
  details?: string;
}

/**
 * Determine elevation type based on elevation value
 */
export function getElevationType(elevation: number): ElevationType {
  if (elevation < 0.4) return 'flat';
  if (elevation < 0.7) return 'hills';
  return 'mountains';
}

/**
 * Classify biome based on elevation, temperature, and moisture
 * Respects original land/ocean boundary: elevation < 0.5 = ocean, >= 0.5 = land
 * Uses realistic biome placement patterns based on climate science
 */
export function classifyBiome(elevation: number, temperature: number, moisture: number): BiomeType {
  // Respect the original land/ocean boundary from the base map generation
  // This ensures we don't alter the existing land/ocean distribution
  const isOcean = elevation < 0.5;
  
  if (isOcean) {
    // Ocean biomes - distinguish between deep and shallow water
    // Keep existing ocean areas as ocean or shallow ocean only
    return elevation < 0.2 ? 'deep_ocean' : 'shallow_ocean';
  }
  
  // Land biomes (elevation >= 0.5) - classify based on realistic climate patterns
  // Temperature ranges: 0 (coldest) to 1 (hottest)
  // Moisture ranges: 0 (driest) to 1 (wettest)
  
  // Arctic and Alpine zones (very cold)
  if (temperature < 0.1) {
    // Permanently frozen areas
    return 'arctic';
  }
  
  if (temperature < 0.2) {
    // High altitude or polar regions
    return elevation > 0.8 ? 'alpine' : 'arctic';
  }
  
  // Subarctic zones (cold)
  if (temperature < 0.35) {
    if (moisture < 0.2) {
      // Cold, dry = tundra
      return 'tundra';
    }
    // Cold, wet = boreal forest (taiga), or alpine if very high
    return elevation > 0.8 ? 'alpine' : 'taiga';
  }
  
  // Temperate zones (moderate temperature)
  if (temperature < 0.6) {
    if (moisture < 0.2) {
      // Dry temperate = grassland/steppe
      return 'grassland';
    }
    if (moisture < 0.7) {
      // Moderate moisture = temperate forest
      return 'forest';
    }
    // Wet temperate = swamps in low areas, forests on hills
    return elevation < 0.65 ? 'swamp' : 'forest';
  }
  
  // Warm temperate to subtropical (warm but not hot)
  if (temperature < 0.8) {
    if (moisture < 0.15) {
      // Very dry, warm = desert
      return 'desert';
    }
    if (moisture < 0.4) {
      // Dry, warm = savanna/grassland
      return 'savanna';
    }
    if (moisture < 0.75) {
      // Moderate moisture = temperate to subtropical forest
      return 'forest';
    }
    // High moisture = wetlands or tropical-like forests
    return elevation < 0.6 ? 'swamp' : 'tropical_forest';
  }
  
  // Hot tropical zones (very hot)
  if (moisture < 0.1) {
    // Extremely dry and hot = desert
    return 'desert';
  }
  if (moisture < 0.3) {
    // Dry hot = savanna
    return 'savanna';
  }
  // Wet hot = tropical forest, with swamps in low-lying areas
  return elevation < 0.55 ? 'swamp' : 'tropical_forest';
}

/**
 * Convert a full Tile to compact representation
 */
export function tileToCompact(tile: Tile): CompactTile {
  const tileIndex = TILE_TYPES.indexOf(tile.type);
  if (tileIndex === -1) {
    throw new Error(`Unknown tile type: ${tile.type}`);
  }
  
  const biomeIndex = BIOME_TYPES.indexOf(tile.biome);
  if (biomeIndex === -1) {
    throw new Error(`Unknown biome type: ${tile.biome}`);
  }
  
  const riverIndex = RIVER_TYPES.indexOf(tile.river);
  if (riverIndex === -1) {
    throw new Error(`Unknown river type: ${tile.river}`);
  }
  
  return {
    t: tileIndex,
    e: Math.round(tile.elevation * 255),
    tmp: Math.round(tile.temperature * 255),
    m: Math.round(tile.moisture * 255),
    b: biomeIndex,
    r: riverIndex,
    l: tile.lake ? 1 : 0
  };
}

/**
 * Convert compact representation back to full Tile
 */
export function compactToTile(compact: CompactTile, x: number, y: number): Tile {
  const elevation = compact.e / 255;
  const temperature = compact.tmp / 255;
  const moisture = compact.m / 255;
  const biome = BIOME_TYPES[compact.b];
  const elevationType = getElevationType(elevation);
  const river = RIVER_TYPES[compact.r];
  const lake = compact.l === 1;
  
  return {
    type: TILE_TYPES[compact.t],
    x,
    y,
    elevation,
    temperature,
    moisture,
    biome,
    elevationType,
    river,
    lake
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