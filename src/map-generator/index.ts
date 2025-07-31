export interface Tile {
  type: 'land' | 'ocean';
  x: number;
  y: number;
  elevation: number; // 0-1, where 0 is sea level
  temperature: number; // 0-1, where 0 is coldest, 1 is hottest
  moisture: number; // 0-1, where 0 is driest, 1 is wettest
  biome: BiomeType; // Calculated biome based on elevation, temperature, moisture
  elevationType: ElevationType; // Calculated elevation category
  river: RiverType; // River segment type at this tile
}

// Import shared types for paginated generation
import { 
  MapPageRequest, 
  MapPageResponse, 
  MapChunkRequest,
  MapChunkResponse,
  CompactTile, 
  tileToCompact,
  BiomeType,
  ElevationType,
  RiverType,
  classifyBiome,
  getElevationType,
  CHUNK_SIZE
} from '../shared/types.js';

/**
 * Simple Perlin noise implementation for terrain generation
 * Based on Ken Perlin's improved noise function
 */
class PerlinNoise {
  private permutation: number[];
  
  constructor(seed: number = Math.random()) {
    // Create permutation table based on seed
    this.permutation = new Array(512);
    const p = new Array(256);
    
    // Initialize with values 0-255
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    // Shuffle array using seed
    const random = this.seedRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    // Duplicate for wrapping
    for (let i = 0; i < 512; i++) {
      this.permutation[i] = p[i % 256];
    }
  }
  
  private seedRandom(seed: number): () => number {
    let m = 0x80000000; // 2**31
    let a = 1103515245;
    let c = 12345;
    seed = seed % m;
    
    return function() {
      seed = (a * seed + c) % m;
      return seed / (m - 1);
    };
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const AA = this.permutation[A];
    const AB = this.permutation[A + 1];
    const B = this.permutation[X + 1] + Y;
    const BA = this.permutation[B];
    const BB = this.permutation[B + 1];
    
    return this.lerp(v,
      this.lerp(u, this.grad(this.permutation[AA], x, y),
                   this.grad(this.permutation[BA], x - 1, y)),
      this.lerp(u, this.grad(this.permutation[AB], x, y - 1),
                   this.grad(this.permutation[BB], x - 1, y - 1))
    );
  }
  
  /**
   * Multi-octave noise for more complex terrain
   */
  octaveNoise(x: number, y: number, octaves: number, persistence: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return value / maxValue;
  }
}

/**
 * Determines tile type based on elevation - simplified per specs
 * Specs only mention 'land' and 'ocean' tile types
 * Uses post-processed elevation values that already ensure proper ocean coverage
 */
function getTileType(elevation: number): Tile['type'] {
  // Post-processed elevations: < 0.5 = ocean, >= 0.5 = land
  return elevation < 0.5 ? 'ocean' : 'land';
}



/**
 * Create seeded random function
 */
function seedRandom(seed: number): () => number {
  let m = 0x80000000; // 2**31
  let a = 1103515245;
  let c = 12345;
  seed = seed % m;
  
  return function() {
    seed = (a * seed + c) % m;
    return seed / (m - 1);
  };
}





/**
 * River noise generators cache
 */
interface RiverNoiseGenerators {
  source: PerlinNoise;
  drainage: PerlinNoise;
}

const riverNoiseCache = new Map<number, RiverNoiseGenerators>();

/**
 * Get or create cached river noise generators for a seed
 */
function getRiverNoiseGenerators(seed: number): RiverNoiseGenerators {
  if (riverNoiseCache.has(seed)) {
    return riverNoiseCache.get(seed)!;
  }
  
  const noiseGenerators: RiverNoiseGenerators = {
    source: new PerlinNoise(seed + 1000),
    drainage: new PerlinNoise(seed + 2000)
  };
  
  riverNoiseCache.set(seed, noiseGenerators);
  return noiseGenerators;
}

/**
 * Calculate the flow direction based on elevation gradients (optimized)
 */
function calculateFlowDirection(x: number, y: number, seed: number): { dx: number, dy: number } {
  // Sample elevation at neighboring tiles (simplified to 4 cardinal directions)
  const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: 0 },  // East
    { dx: 0, dy: 1 },  // South
    { dx: -1, dy: 0 }  // West
  ];
  
  const currentElevation = calculateLandStrengthAtChunk(x, y, seed);
  let steepestDrop = 0;
  let flowDirection = { dx: 0, dy: 0 };
  
  for (const dir of directions) {
    const neighborX = x + dir.dx;
    const neighborY = y + dir.dy;
    const neighborElevation = calculateLandStrengthAtChunk(neighborX, neighborY, seed);
    
    const elevationDrop = currentElevation - neighborElevation;
    if (elevationDrop > steepestDrop) {
      steepestDrop = elevationDrop;
      flowDirection = dir;
    }
  }
  
  return flowDirection;
}

/**
 * Determine if a location should be a river source (optimized)
 */
function isRiverSource(x: number, y: number, seed: number, elevation: number, riverNoise: RiverNoiseGenerators): boolean {
  // Only land tiles can be river sources
  if (elevation < 0.5) return false;
  
  // Adjust threshold to actual land elevation range (0.51-1.0)
  if (elevation < 0.52) return false; // Only use higher land areas
  
  // Use cached noise generator
  const sourceValue = riverNoise.source.noise(x * 0.02, y * 0.02);
  
  // More balanced source placement 
  return sourceValue > 0.3;
}

/**
 * Calculate simplified flow accumulation using cached noise (optimized)
 */
function calculateFlowAccumulation(x: number, y: number, riverNoise: RiverNoiseGenerators): number {
  // Use cached noise to simulate drainage patterns, but make it sparser
  const drainageValue = riverNoise.drainage.octaveNoise(x * 0.02, y * 0.02, 2, 0.5);
  
  // Convert to positive values and scale down for less dense rivers
  return (drainageValue + 1) * 1.5;
}

/**
 * Determine the river segment type (optimized)
 */
function calculateRiverType(x: number, y: number, seed: number): RiverType {
  const elevation = calculateLandStrengthAtChunk(x, y, seed);
  
  // No rivers in ocean
  if (elevation < 0.5) return 'none';
  
  // Use cached river noise generators
  const riverNoise = getRiverNoiseGenerators(seed);
  
  const flowAccumulation = calculateFlowAccumulation(x, y, riverNoise);
  const isSource = isRiverSource(x, y, seed, elevation, riverNoise);
  
  // Balanced threshold for river presence
  const riverThreshold = isSource ? 1.2 : 2.0;
  
  if (flowAccumulation < riverThreshold) return 'none';
  
  const flowDirection = calculateFlowDirection(x, y, seed);
  
  // If no clear flow direction, no river
  if (flowDirection.dx === 0 && flowDirection.dy === 0) return 'none';
  
  // Determine segment type based on flow direction (simplified)
  if (flowDirection.dy === 0) {
    return 'horizontal';
  } else if (flowDirection.dx === 0) {
    return 'vertical';
  } else {
    // For diagonal flow, randomly pick a bend type based on direction
    if (flowDirection.dx > 0 && flowDirection.dy > 0) {
      return 'bend_se';
    } else if (flowDirection.dx > 0 && flowDirection.dy < 0) {
      return 'bend_ne';
    } else if (flowDirection.dx < 0 && flowDirection.dy > 0) {
      return 'bend_sw';
    } else {
      return 'bend_nw';
    }
  }
}

/**
 * Cached continent data for performance optimization
 */
interface ContinentData {
  centers: Array<{x: number, y: number}>;
  numContinents: number;
  noiseGenerators: {
    continent: PerlinNoise;
    detail: PerlinNoise;
    warpX: PerlinNoise;
    warpY: PerlinNoise;
  };
}

// Cache for continent data by seed to avoid recalculation
const continentCache = new Map<number, ContinentData>();

/**
 * Get or create cached continent data for a seed
 */
function getContinentData(seed: number): ContinentData {
  if (continentCache.has(seed)) {
    return continentCache.get(seed)!;
  }
  
  // Use a fixed reference world size for consistent continental patterns
  const referenceWidth = 1000;
  const referenceHeight = 1000;
  
  // Create seeded random function
  const random = seedRandom(seed);
  
  // Determine number of continents (1, 2, or 3)
  const numContinents = Math.floor(random() * 3) + 1;
  
  // Create noise generators once per seed
  const noiseGenerators = {
    continent: new PerlinNoise(seed),
    detail: new PerlinNoise(seed + 100),
    warpX: new PerlinNoise(seed + 200),
    warpY: new PerlinNoise(seed + 300)
  };
  
  // Generate continent centers ensuring proper separation
  const centers: Array<{x: number, y: number}> = [];
  const minSeparation = referenceWidth * 0.05;
  
  for (let i = 0; i < numContinents; i++) {
    let attempts = 0;
    let validPosition = false;
    let continentX = referenceWidth * 0.5;
    let continentY = referenceHeight * 0.5;
    
    while (!validPosition && attempts < 100) {
      continentX = (referenceWidth * 0.15) + random() * (referenceWidth * 0.7);
      continentY = (referenceHeight * 0.15) + random() * (referenceHeight * 0.7);
      
      validPosition = true;
      for (const existing of centers) {
        const dx = continentX - existing.x;
        const dy = continentY - existing.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minSeparation) {
          validPosition = false;
          break;
        }
      }
      attempts++;
    }
    
    if (!validPosition) {
      // Fallback positioning for multiple continents
      if (i === 1) {
        continentX = referenceWidth * 0.25;
        continentY = referenceHeight * 0.5;
      } else if (i === 2) {
        continentX = referenceWidth * 0.75;
        continentY = referenceHeight * 0.5;
      }
    }
    
    centers.push({ x: continentX, y: continentY });
  }
  
  const continentData: ContinentData = {
    centers,
    numContinents,
    noiseGenerators
  };
  
  continentCache.set(seed, continentData);
  return continentData;
}

/**
 * Optimized land strength calculation using cached continent data
 */
function calculateLandStrengthAtChunk(x: number, y: number, seed: number): number {
  // Use cached continent data
  const continentData = getContinentData(seed);
  const { centers, noiseGenerators } = continentData;
  const referenceWidth = 1000;
  const referenceHeight = 1000;
  
  // Apply domain warping for natural, irregular shapes
  const warpStrength = 15.0;
  const warpX = x + noiseGenerators.warpX.octaveNoise(x * 0.008, y * 0.008, 3, 0.5) * warpStrength;
  const warpY = y + noiseGenerators.warpY.octaveNoise(x * 0.008, y * 0.008, 3, 0.5) * warpStrength;
  
  // Large-scale continent shape (reduced octaves from 3 to 2 for performance)
  const continentShape = noiseGenerators.continent.octaveNoise(warpX * 0.003, warpY * 0.003, 2, 0.6);
  
  // Medium-scale features (reduced octaves from 4 to 3)
  const mediumFeatures = noiseGenerators.continent.octaveNoise(warpX * 0.008, warpY * 0.008, 3, 0.5);
  
  // Fine-scale coastal details (reduced octaves from 3 to 2)
  const coastalDetails = noiseGenerators.detail.octaveNoise(warpX * 0.02, warpY * 0.02, 2, 0.4);
  
  // Combine noise layers for natural landmass shape
  let elevation = continentShape * 0.6 + mediumFeatures * 0.3 + coastalDetails * 0.1;
  
  // Optimized distance-based influence from continent centers
  let centerInfluence = 0;
  const influenceScale = 1.0 / (referenceWidth * 0.3);
  for (const center of centers) {
    const dx = (x - center.x) * influenceScale;
    const dy = (y - center.y) * influenceScale;
    const distanceSquared = dx * dx + dy * dy;
    
    // Avoid expensive sqrt and pow operations
    const influence = distanceSquared < 1 ? Math.max(0, 1 - distanceSquared * 1.8) : 0;
    centerInfluence = Math.max(centerInfluence, influence);
  }
  
  // Ensure we always have some landmass near continent centers
  const landBoost = centerInfluence * 0.35;
  
  // Combine noise elevation with center influence
  elevation = elevation * 0.65 + centerInfluence * 0.18 + landBoost;
  
  // Normalize to 0-1 and clamp
  elevation = (elevation + 1) / 2;
  elevation = Math.max(0, Math.min(1, elevation));
  
  // Direct threshold for ocean coverage
  const oceanThreshold = 0.495;
  
  if (elevation < oceanThreshold) {
    // Ocean: scale from 0.1 to 0.49
    const oceanPosition = elevation / oceanThreshold;
    return 0.1 + oceanPosition * 0.39;
  } else {
    // Land: scale from 0.51 to 1.0
    const landPosition = (elevation - oceanThreshold) / (1 - oceanThreshold);
    return 0.51 + landPosition * 0.49;
  }
}

/**
 * Optimized noise generators cache for tiles
 */
interface TileNoiseGenerators {
  elevation: PerlinNoise;
  temperature: PerlinNoise;
  moisture: PerlinNoise;
}

const tileNoiseCache = new Map<number, TileNoiseGenerators>();

/**
 * Get or create cached tile noise generators for a seed
 */
function getTileNoiseGenerators(seed: number): TileNoiseGenerators {
  if (tileNoiseCache.has(seed)) {
    return tileNoiseCache.get(seed)!;
  }
  
  const noiseGenerators: TileNoiseGenerators = {
    elevation: new PerlinNoise(seed + 1),
    temperature: new PerlinNoise(seed + 2),
    moisture: new PerlinNoise(seed + 3)
  };
  
  tileNoiseCache.set(seed, noiseGenerators);
  return noiseGenerators;
}

/**
 * Optimized tile generation with cached noise generators
 */
function generateTileAtChunk(x: number, y: number, seed: number): Tile {
  // Use cached noise generators
  const noiseGenerators = getTileNoiseGenerators(seed);
  
  // Calculate land strength using optimized cached function
  const landStrength = calculateLandStrengthAtChunk(x, y, seed);
  
  // Apply the same elevation calculation as generateMap
  let elevation = landStrength;
  
  // Add detailed terrain elevation using noise for land areas (reduced octaves for performance)
  if (landStrength >= 0.5) {
    const terrainElevation = noiseGenerators.elevation.octaveNoise(x * 0.01, y * 0.01, 4, 0.5); // Reduced from 6 to 4 octaves
    const terrainVariation = (terrainElevation + 1) / 2; // Normalize to 0-1
    
    // Combine base land shape with terrain details
    elevation = landStrength * 0.7 + terrainVariation * landStrength * 0.5;
    
    // Ensure minimum land elevation
    elevation = Math.max(elevation, 0.51);
  } else {
    // Ocean areas - add seafloor variation (reduced octaves)
    const seafloorVariation = noiseGenerators.elevation.octaveNoise(x * 0.005, y * 0.005, 2, 0.3); // Reduced from 3 to 2 octaves
    elevation = landStrength + Math.max(0, seafloorVariation * 0.05);
    elevation = Math.min(elevation, 0.49);
  }
  
  // Clamp elevation to valid range
  elevation = Math.max(0, Math.min(1, elevation));
  
  // Generate temperature based on latitude (reduced octaves for performance)
  const referenceHeight = 1000;
  const latitudeFactor = Math.abs((y / referenceHeight) - 0.5) * 2; // 0 at equator, 1 at poles
  let temperature = 1 - latitudeFactor; // Hot at equator, cold at poles
  temperature += noiseGenerators.temperature.octaveNoise(x * 0.008, y * 0.008, 2, 0.3) * 0.3; // Reduced from 3 to 2 octaves
  temperature -= elevation * 0.5; // Higher elevation = colder
  temperature = Math.max(0, Math.min(1, temperature));
  
  // Generate moisture patterns (reduced octaves for performance)
  let moisture = noiseGenerators.moisture.octaveNoise(x * 0.012, y * 0.012, 3, 0.4); // Reduced from 4 to 3 octaves
  moisture = (moisture + 1) / 2; // Normalize to 0-1
  moisture = Math.max(0, Math.min(1, moisture));
  
  // Determine tile type based on specs (land or ocean)
  const tileType = getTileType(elevation);
  
  // Classify biome and elevation type
  const biome = classifyBiome(elevation, temperature, moisture);
  const elevationType = getElevationType(elevation);
  
  // Generate river information (optimized)
  const river = calculateRiverType(x, y, seed);
  
  return {
    type: tileType,
    x,
    y,
    elevation,
    temperature,
    moisture,
    biome,
    elevationType,
    river
  };
}

/**
 * Clear all caches to prevent memory leaks
 */
export function clearGenerationCaches(): void {
  continentCache.clear();
  tileNoiseCache.clear();
  riverNoiseCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { continents: number, tileNoise: number, riverNoise: number } {
  return {
    continents: continentCache.size,
    tileNoise: tileNoiseCache.size,
    riverNoise: riverNoiseCache.size
  };
}

/**
 * Benchmark chunk generation performance
 */
export function benchmarkChunkGeneration(numChunks: number, seed?: number): { 
  totalTime: number, 
  chunksPerSecond: number, 
  tilesPerSecond: number,
  averageTimePerChunk: number 
} {
  const testSeed = seed ?? 12345;
  const startTime = performance.now();
  
  // Generate chunks in a grid pattern
  const chunksSide = Math.ceil(Math.sqrt(numChunks));
  let chunksGenerated = 0;
  
  for (let chunkY = 0; chunkY < chunksSide && chunksGenerated < numChunks; chunkY++) {
    for (let chunkX = 0; chunkX < chunksSide && chunksGenerated < numChunks; chunkX++) {
      generateChunk(chunkX, chunkY, testSeed);
      chunksGenerated++;
    }
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const totalTiles = chunksGenerated * CHUNK_SIZE * CHUNK_SIZE;
  
  return {
    totalTime,
    chunksPerSecond: (chunksGenerated / totalTime) * 1000,
    tilesPerSecond: (totalTiles / totalTime) * 1000,
    averageTimePerChunk: totalTime / chunksGenerated
  };
}

/**
 * Generate a single chunk of 16x16 tiles at the specified chunk coordinates
 * This is the core function for the new chunk-based world generation system
 * Based on the existing generateMap logic to ensure consistency
 */
export function generateChunk(chunkX: number, chunkY: number, seed?: number): Tile[][] {
  const mapSeed = seed ?? Math.floor(Math.random() * 1000000);
  
  // Calculate world coordinates for this chunk
  const startX = chunkX * CHUNK_SIZE;
  const startY = chunkY * CHUNK_SIZE;
  
  const chunk: Tile[][] = [];
  
  // Generate each tile in the chunk using the chunk-optimized algorithm
  for (let localY = 0; localY < CHUNK_SIZE; localY++) {
    const row: Tile[] = [];
    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      const worldX = startX + localX;
      const worldY = startY + localY;
      
      // Generate tile using the chunk-optimized function
      const tile = generateTileAtChunk(worldX, worldY, mapSeed);
      
      row.push(tile);
    }
    chunk.push(row);
  }
  
  return chunk;
}

/**
 * Generate a chunk and return it in the API response format
 */
export function generateMapChunk(request: MapChunkRequest): MapChunkResponse {
  const { chunkX, chunkY, seed } = request;
  
  // Parse seed - support both string and number seeds for compatibility
  const seedNumber = typeof seed === 'string' ? hashSeed(seed) : seed;
  
  // Generate the chunk
  const chunk = generateChunk(chunkX, chunkY, seedNumber);
  
  // Convert to compact tiles
  const tiles: CompactTile[][] = chunk.map(row => 
    row.map(tile => tileToCompact(tile))
  );
  
  // Calculate payload size
  const responseJson = JSON.stringify({ tiles });
  const sizeBytes = Buffer.byteLength(responseJson, 'utf8');
  
  return {
    chunkX,
    chunkY,
    seed,
    tiles,
    sizeBytes
  };
}

/**
 * Simple hash function to convert string seed to number
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Validate that a chunk request is within reasonable limits
 */
export function validateMapChunkRequest(request: MapChunkRequest): void {
  const { chunkX, chunkY, seed } = request;
  
  if (!seed || (typeof seed === 'string' && seed.length === 0)) {
    throw new Error('Seed is required');
  }
  
  // Allow reasonable chunk coordinate range - limit to prevent memory issues
  const maxChunkCoord = 10000; // Allows for 160,000 x 160,000 tile worlds
  const minChunkCoord = -10000;
  
  if (chunkX < minChunkCoord || chunkX > maxChunkCoord) {
    throw new Error(`Chunk X coordinate must be between ${minChunkCoord} and ${maxChunkCoord}`);
  }
  
  if (chunkY < minChunkCoord || chunkY > maxChunkCoord) {
    throw new Error(`Chunk Y coordinate must be between ${minChunkCoord} and ${maxChunkCoord}`);
  }
}

