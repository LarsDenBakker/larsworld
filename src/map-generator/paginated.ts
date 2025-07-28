import { Tile, BiomeType, CompactTile, tileToCompact, MapPageRequest, MapPageResponse } from '../shared/types.js';

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
 * Deterministic Perlin noise implementation using seed-based generation
 * Stateless - generates the same values for the same coordinates and seed
 */
class DeterministicPerlinNoise {
  private seed: number;
  
  constructor(seed: string | number) {
    this.seed = typeof seed === 'string' ? hashSeed(seed) : seed;
  }
  
  private seedRandom(x: number, y: number, offset: number = 0): number {
    // Create a deterministic random value based on coordinates and seed
    let n = Math.sin((x + offset) * 12.9898 + (y + offset) * 78.233 + this.seed * 0.001) * 43758.5453;
    return n - Math.floor(n); // Return fractional part
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }
  
  private grad(x: number, y: number, dx: number, dy: number): number {
    // Create deterministic gradient based on grid position
    const rand = this.seedRandom(x, y);
    const angle = rand * 2 * Math.PI;
    const gx = Math.cos(angle);
    const gy = Math.sin(angle);
    return gx * dx + gy * dy;
  }
  
  noise(x: number, y: number): number {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    
    const fx = x - X;
    const fy = y - Y;
    
    const u = this.fade(fx);
    const v = this.fade(fy);
    
    const n00 = this.grad(X, Y, fx, fy);
    const n10 = this.grad(X + 1, Y, fx - 1, fy);
    const n01 = this.grad(X, Y + 1, fx, fy - 1);
    const n11 = this.grad(X + 1, Y + 1, fx - 1, fy - 1);
    
    const nx0 = this.lerp(u, n00, n10);
    const nx1 = this.lerp(u, n01, n11);
    
    return this.lerp(v, nx0, nx1);
  }
  
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
 * Determines biome based on temperature, moisture, and elevation
 */
function getBiome(temperature: number, moisture: number, elevation: number): BiomeType {
  // Ocean and shallow water based on elevation
  if (elevation < 0.25) {
    return elevation < 0.15 ? 'ocean' : 'shallow_water';
  }
  
  // Beach areas just above water
  if (elevation < 0.3) {
    return 'beach';
  }
  
  // Snow-capped mountains
  if (elevation > 0.85) {
    return 'snow';
  }
  
  // High mountains
  if (elevation > 0.75) {
    return 'mountain';
  }
  
  // Tundra in cold areas
  if (temperature < 0.25) {
    return 'tundra';
  }
  
  // Desert in hot, dry areas
  if (temperature > 0.7 && moisture < 0.4) {
    return 'desert';
  }
  
  // Swamp in hot, very wet areas with low elevation
  if (temperature > 0.6 && moisture > 0.8 && elevation < 0.5) {
    return 'swamp';
  }
  
  // Forest in moderate to high moisture
  if (moisture > 0.6) {
    return 'forest';
  }
  
  // Default to grassland
  return 'grassland';
}

/**
 * Generate a single tile at specific coordinates using deterministic noise
 */
function generateTileAt(x: number, y: number, width: number, height: number, seed: string): Tile {
  // Create noise generators with seed-based deterministic values
  const elevationNoise = new DeterministicPerlinNoise(seed + '_elevation');
  const continentalNoise = new DeterministicPerlinNoise(seed + '_continental');
  const coastalNoise = new DeterministicPerlinNoise(seed + '_coastal');
  const temperatureNoise = new DeterministicPerlinNoise(seed + '_temperature');
  const moistureNoise = new DeterministicPerlinNoise(seed + '_moisture');
  
  // Determine if this is a large map for different generation parameters
  const isLargeMap = width >= 500 && height >= 500;
  
  // Scale factors for noise sampling
  const continentalScale = isLargeMap ? 0.002 : 0.01;
  const elevationScale = isLargeMap ? 0.008 : 0.05;
  const coastalScale = isLargeMap ? 0.02 : 0.1;
  const temperatureScale = isLargeMap ? 0.004 : 0.02;
  const moistureScale = isLargeMap ? 0.015 : 0.08;
  
  let elevation = 0;
  
  if (isLargeMap) {
    // Create realistic continental patterns using layered noise
    const continentalPattern = continentalNoise.octaveNoise(x * continentalScale, y * continentalScale, 4, 0.6);
    const regionalElevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 6, 0.5);
    const coastalComplexity = coastalNoise.octaveNoise(x * coastalScale, y * coastalScale, 4, 0.4);
    
    let baseLand = continentalPattern * 0.7 + regionalElevation * 0.3;
    baseLand += coastalComplexity * 0.15;
    
    elevation = (baseLand + 1) / 2; // Normalize to 0-1
    elevation = Math.pow(elevation, 1.2); // Slightly favor lower elevations for more ocean
    
    if (elevation > 0.35) {
      // Land areas - add more elevation variation
      elevation = 0.35 + (elevation - 0.35) * 1.4;
      
      // Add mountain ranges using ridge noise
      const ridgeNoise = Math.abs(elevationNoise.octaveNoise(x * elevationScale * 2, y * elevationScale * 2, 3, 0.5));
      if (elevation > 0.6) {
        elevation += ridgeNoise * 0.3; // Mountain ranges on higher terrain
      }
    } else {
      // Ocean areas - keep lower but add some seafloor variation
      elevation = elevation * 0.8;
    }
  } else {
    // Original logic for smaller maps
    elevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 5, 0.5);
    elevation = (elevation + 1) / 2; // Normalize to 0-1
    elevation = Math.pow(elevation, 0.8);
    if (elevation < 0.4) {
      elevation = elevation * 0.7;
    }
  }
  
  // Generate temperature based on latitude (distance from center) and elevation
  const latitudeFactor = Math.abs((y / height) - 0.5) * 2; // 0 at equator, 1 at poles
  let temperature = 1 - latitudeFactor; // Hot at equator, cold at poles
  temperature += temperatureNoise.octaveNoise(x * temperatureScale, y * temperatureScale, 2, 0.3) * 0.3;
  temperature -= elevation * 0.4; // Higher elevation = colder
  temperature = Math.max(0, Math.min(1, temperature)); // Clamp to 0-1
  
  // Generate moisture patterns
  let moisture = moistureNoise.octaveNoise(x * moistureScale, y * moistureScale, 3, 0.4);
  moisture = (moisture + 1) / 2; // Normalize to 0-1
  moisture = Math.max(0, Math.min(1, moisture)); // Clamp to 0-1
  
  // Determine biome based on climate and elevation
  const biome = getBiome(temperature, moisture, elevation);
  
  return {
    type: biome,
    x,
    y,
    elevation,
    temperature,
    moisture
  };
}

/**
 * Calculate optimal page size to stay under 6MB limit
 */
function calculateOptimalPageSize(width: number): number {
  // Each compact tile is roughly 25 bytes when JSON stringified
  // 6MB = 6 * 1024 * 1024 = 6,291,456 bytes
  // Add overhead for response metadata (~1000 bytes)
  const maxPayloadSize = 6 * 1024 * 1024 - 1000;
  const bytesPerTile = 25;
  const bytesPerRow = width * bytesPerTile;
  
  // Calculate max rows that fit in 6MB
  const maxRows = Math.floor(maxPayloadSize / bytesPerRow);
  
  // Ensure minimum of 1 row and maximum of reasonable chunk size
  return Math.max(1, Math.min(maxRows, 256));
}

/**
 * Generate a page of map data using stateless, deterministic generation
 */
export function generateMapPage(request: MapPageRequest): MapPageResponse {
  const { page, pageSize, width, height, seed } = request;
  
  // Calculate optimal page size if requested size would exceed 6MB
  const optimalPageSize = calculateOptimalPageSize(width);
  const actualPageSize = Math.min(pageSize, optimalPageSize);
  
  const totalPages = Math.ceil(height / actualPageSize);
  const startY = page * actualPageSize;
  const endY = Math.min(startY + actualPageSize, height);
  
  // Validate request
  if (page < 0 || page >= totalPages) {
    throw new Error(`Invalid page ${page}. Must be between 0 and ${totalPages - 1}`);
  }
  
  if (width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive');
  }
  
  // Generate tiles for this page
  const tiles: CompactTile[][] = [];
  
  for (let y = startY; y < endY; y++) {
    const row: CompactTile[] = [];
    for (let x = 0; x < width; x++) {
      const tile = generateTileAt(x, y, width, height, seed);
      row.push(tileToCompact(tile));
    }
    tiles.push(row);
  }
  
  // Calculate actual payload size
  const responseJson = JSON.stringify({ tiles });
  const sizeBytes = Buffer.byteLength(responseJson, 'utf8');
  
  return {
    page,
    pageSize: actualPageSize,
    totalPages,
    width,
    height,
    seed,
    startY,
    endY,
    tiles,
    sizeBytes
  };
}

/**
 * Validate that a map page request is within reasonable limits
 */
export function validateMapPageRequest(request: MapPageRequest): void {
  const { page, pageSize, width, height, seed } = request;
  
  if (!seed || seed.length === 0) {
    throw new Error('Seed is required');
  }
  
  if (width <= 0 || width > 10000) {
    throw new Error('Width must be between 1 and 10000');
  }
  
  if (height <= 0 || height > 10000) {
    throw new Error('Height must be between 1 and 10000');
  }
  
  if (pageSize <= 0 || pageSize > 1000) {
    throw new Error('Page size must be between 1 and 1000');
  }
  
  if (page < 0) {
    throw new Error('Page must be non-negative');
  }
}