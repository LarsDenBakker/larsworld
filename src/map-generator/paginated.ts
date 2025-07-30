import { Tile, TileType, CompactTile, tileToCompact, MapPageRequest, MapPageResponse } from '../shared/types.js';

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
 * Determines tile type based on elevation - simplified per specs
 */
function getTileType(elevation: number): TileType {
  return elevation < 0.25 ? 'ocean' : 'land';
}

/**
 * Generate a single tile at specific coordinates using deterministic noise
 * Enhanced for realistic continental patterns
 */
function generateTileAt(x: number, y: number, seed: string): Tile {
  // Fixed dimensions for all maps
  const width = 1000;
  const height = 1000;
  
  // Create noise generators with seed-based deterministic values
  const elevationNoise = new DeterministicPerlinNoise(seed + '_elevation');
  const continentalNoise = new DeterministicPerlinNoise(seed + '_continental');
  const coastalNoise = new DeterministicPerlinNoise(seed + '_coastal');
  const temperatureNoise = new DeterministicPerlinNoise(seed + '_temperature');
  const moistureNoise = new DeterministicPerlinNoise(seed + '_moisture');
  
  // Enhanced continental generation - create 2 main continents usually
  const continentalNoise2 = new DeterministicPerlinNoise(seed + '_continental2');
  
  // Scale factors optimized for 1000x1000 maps with realistic continents
  const continentalScale = 0.0015; // Larger continental patterns for fewer, bigger continents
  const continentalScale2 = 0.0018; // Slightly different scale for variation
  const elevationScale = 0.008;
  const coastalScale = 0.025; // More coastal complexity
  const temperatureScale = 0.004;
  const moistureScale = 0.015;

  let elevation = 0;
  
  // Create realistic continental patterns - aim for ~45% land coverage (1.5x Earth's ratio)
  
  // Primary continental structure - creates main landmass distribution
  const continentalPattern1 = continentalNoise.octaveNoise(x * continentalScale, y * continentalScale, 3, 0.6);
  
  // Secondary continental structure - creates additional continents
  const continentalPattern2 = continentalNoise2.octaveNoise(
    (x + 500) * continentalScale2, // Offset to create different pattern
    (y + 300) * continentalScale2, 
    3, 0.5
  );
  
  // Regional elevation variations
  const regionalElevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 6, 0.5);
  
  // Coastal complexity for realistic coastlines
  const coastalComplexity = coastalNoise.octaveNoise(x * coastalScale, y * coastalScale, 4, 0.4);
  
  // Combine continental patterns - usually creates 2 major continents
  // Use max to create separate continent clusters rather than blending
  const mainContinental = Math.max(continentalPattern1 * 0.8, continentalPattern2 * 0.6);
  
  // Combine all elevation sources
  let baseLand = mainContinental + regionalElevation * 0.2 + coastalComplexity * 0.12;
  
  // Normalize to 0-1 range
  elevation = (baseLand + 1) / 2;
  
  // Apply power curve to create clearer land/ocean distinction and target ~45% land
  // Adjust the curve to create the right land ratio
  elevation = Math.pow(elevation, 1.1); // Less aggressive than before to increase land ratio
  
  // Threshold adjustment for ~45% land coverage
  const landThreshold = 0.25; // Lower threshold = more land
  
  if (elevation > landThreshold) {
    // Land areas - enhance elevation and add mountain ranges
    elevation = landThreshold + (elevation - landThreshold) * 1.6;
    
    // Add mountain ranges using ridge noise on higher terrain
    const ridgeNoise = Math.abs(elevationNoise.octaveNoise(x * elevationScale * 2, y * elevationScale * 2, 3, 0.5));
    if (elevation > 0.6) {
      elevation += ridgeNoise * 0.35; // More prominent mountain ranges
    }
    
    // Ensure land is clearly above sea level
    elevation = Math.max(elevation, 0.35);
  } else {
    // Ocean areas - keep clearly below land threshold with some seafloor variation
    elevation = elevation * 0.75; // Keep ocean distinctly lower
    elevation = Math.min(elevation, 0.25); // Ensure ocean stays below land threshold
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
  
  // Determine tile type based on specs (land or ocean)
  const tileType = getTileType(elevation);
  
  return {
    type: tileType,
    x,
    y,
    elevation,
    temperature,
    moisture
  };
}

/**
 * Calculate optimal page size to stay under 6MB limit for 1000x1000 maps
 */
function calculateOptimalPageSize(): number {
  // Each compact tile is roughly 25 bytes when JSON stringified
  // 6MB = 6 * 1024 * 1024 = 6,291,456 bytes
  // Add overhead for response metadata (~1000 bytes)
  const maxPayloadSize = 6 * 1024 * 1024 - 1000;
  const bytesPerTile = 25;
  const width = 1000; // Fixed width
  const bytesPerRow = width * bytesPerTile;
  
  // Calculate max rows that fit in 6MB
  const maxRows = Math.floor(maxPayloadSize / bytesPerRow);
  
  // Ensure minimum of 1 row and maximum of reasonable chunk size
  return Math.max(1, Math.min(maxRows, 256));
}

/**
 * Generate a page of map data using stateless, deterministic generation for 1000x1000 maps
 */
export function generateMapPage(request: MapPageRequest): MapPageResponse {
  const { page, pageSize, seed } = request;
  
  // Fixed dimensions for all maps
  const width = 1000;
  const height = 1000;
  
  // Calculate optimal page size if requested size would exceed 6MB
  const optimalPageSize = calculateOptimalPageSize();
  const actualPageSize = Math.min(pageSize, optimalPageSize);
  
  const totalPages = Math.ceil(height / actualPageSize);
  const startY = page * actualPageSize;
  const endY = Math.min(startY + actualPageSize, height);
  
  // Validate request
  if (page < 0 || page >= totalPages) {
    throw new Error(`Invalid page ${page}. Must be between 0 and ${totalPages - 1}`);
  }
  
  // Generate tiles for this page
  const tiles: CompactTile[][] = [];
  
  for (let y = startY; y < endY; y++) {
    const row: CompactTile[] = [];
    for (let x = 0; x < width; x++) {
      const tile = generateTileAt(x, y, seed);
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
  const { page, pageSize, seed } = request;
  
  if (!seed || seed.length === 0) {
    throw new Error('Seed is required');
  }
  
  if (pageSize <= 0 || pageSize > 1000) {
    throw new Error('Page size must be between 1 and 1000');
  }
  
  if (page < 0) {
    throw new Error('Page must be non-negative');
  }
}