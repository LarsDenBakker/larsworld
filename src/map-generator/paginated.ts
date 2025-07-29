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
 * Updated for Dwarf Fortress-style biome distribution with clearer ocean/land separation
 */
function getBiome(temperature: number, moisture: number, elevation: number): BiomeType {
  // Ocean and shallow water based on elevation - strict thresholds for clear separation
  if (elevation < 0.35) {
    return elevation < 0.25 ? 'ocean' : 'shallow_water';
  }
  
  // Beach areas just above water - narrow band for clear separation
  if (elevation < 0.4) {
    return 'beach';
  }
  
  // Snow-capped mountains (higher threshold for more selectivity)
  if (elevation > 0.9) {
    return 'snow';
  }
  
  // High mountains - more common than snow peaks but still rare
  if (elevation > 0.75) {
    return 'mountain';
  }
  
  // Tundra in cold areas - more prevalent in DF style
  if (temperature < 0.3) {
    return 'tundra';
  }
  
  // Desert in hot, dry areas - adjusted for DF frequency
  if (temperature > 0.65 && moisture < 0.45) {
    return 'desert';
  }
  
  // Swamp in hot, very wet areas with low elevation - less common
  if (temperature > 0.7 && moisture > 0.85 && elevation < 0.6) {
    return 'swamp';
  }
  
  // Forest in moderate to high moisture - most common land biome in DF
  if (moisture > 0.55) {
    return 'forest';
  }
  
  // Grassland in moderate conditions - second most common
  if (moisture > 0.35 && temperature > 0.25) {
    return 'grassland';
  }
  
  // Default to tundra for cold, dry areas
  return 'tundra';
}

/**
 * Generate a single tile at specific coordinates using deterministic noise
 * Enhanced for Dwarf Fortress-style continental patterns with strict ocean boundaries
 */
function generateTileAt(x: number, y: number, seed: string): Tile {
  // Fixed dimensions for all maps
  const width = 1000;
  const height = 1000;
  
  // Calculate distance from edges for ocean boundary enforcement
  // Require 5% of map size as ocean border (50 pixels for 1000x1000)
  const oceanBorderWidth = Math.floor(Math.min(width, height) * 0.05); // 50 pixels
  const distanceFromEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
  
  // Create noise generators with seed-based deterministic values
  const elevationNoise = new DeterministicPerlinNoise(seed + '_elevation');
  const continentalNoise = new DeterministicPerlinNoise(seed + '_continental');
  const coastalNoise = new DeterministicPerlinNoise(seed + '_coastal');
  const temperatureNoise = new DeterministicPerlinNoise(seed + '_temperature');
  const moistureNoise = new DeterministicPerlinNoise(seed + '_moisture');
  
  // Enhanced continental generation - create 2 main continents usually
  const continentalNoise2 = new DeterministicPerlinNoise(seed + '_continental2');
  
  // Scale factors optimized for 1000x1000 maps with DF-style continents
  const continentalScale = 0.0012; // Larger continental patterns for fewer, bigger continents
  const continentalScale2 = 0.0015; // Slightly different scale for variation
  const elevationScale = 0.008;
  const coastalScale = 0.025; // More coastal complexity
  const temperatureScale = 0.004;
  const moistureScale = 0.015;

  let elevation = 0;
  
  // Hard ocean boundary enforcement - force ocean in border region
  if (distanceFromEdge < oceanBorderWidth) {
    // Force very low elevation to guarantee ocean at edges
    elevation = 0.05 + (distanceFromEdge / oceanBorderWidth) * 0.2; // 0.05 to 0.25 range
    elevation = Math.min(elevation, 0.3); // Ensure below land threshold
  } else {
    // Interior region - generate realistic continental patterns
    // Target ~30% land coverage (DF-style)
    
    // Create fade factor for smooth transition from ocean border
    const fadeDistance = Math.min(30, oceanBorderWidth); // 30 pixel transition zone
    const borderFade = distanceFromEdge < (oceanBorderWidth + fadeDistance) ?
      Math.min(1, (distanceFromEdge - oceanBorderWidth) / fadeDistance) : 1;
    
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
    
    // Combine continental patterns to create separate continent clusters
    // Use different approach to ensure proper separation
    const continent1 = Math.max(0, continentalPattern1);
    const continent2 = Math.max(0, continentalPattern2);
    const mainContinental = Math.max(continent1 * 0.75, continent2 * 0.6);
    
    // Combine all elevation sources
    let baseLand = mainContinental + regionalElevation * 0.2 + coastalComplexity * 0.12;
    
    // Normalize to 0-1 range
    elevation = (baseLand + 1) / 2;
    
    // Apply power curve to target ~30% land coverage (DF-style)
    elevation = Math.pow(elevation, 1.1); // Less aggressive to allow more land
    
    // Threshold adjustment for ~30% land coverage
    const landThreshold = 0.4; // Moderate threshold for balanced land/ocean
    
    if (elevation > landThreshold) {
      // Land areas - enhance elevation and add mountain ranges
      elevation = landThreshold + (elevation - landThreshold) * 1.3;
      
      // Add mountain ranges using ridge noise on higher terrain
      const ridgeNoise = Math.abs(elevationNoise.octaveNoise(x * elevationScale * 2, y * elevationScale * 2, 3, 0.5));
      if (elevation > 0.6) {
        elevation += ridgeNoise * 0.25; // Mountain ranges on higher terrain
      }
      
      // Ensure land is clearly above sea level
      elevation = Math.max(elevation, 0.45);
    } else {
      // Ocean areas - keep clearly below land threshold with some seafloor variation
      elevation = elevation * 0.8; // Keep ocean distinctly lower
      elevation = Math.min(elevation, 0.35); // Ensure ocean stays below land threshold
    }
    
    // Apply border fade to smooth transition from forced ocean border
    elevation = elevation * borderFade + (1 - borderFade) * 0.2;
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