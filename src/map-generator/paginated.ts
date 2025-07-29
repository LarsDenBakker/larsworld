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
 * Enhanced for Dwarf Fortress-style continental patterns with realistic geography
 */
function generateTileAt(x: number, y: number, seed: string): Tile {
  // Fixed dimensions for all maps
  const width = 1000;
  const height = 1000;
  
  // Create noise generators with seed-based deterministic values
  const elevationNoise = new DeterministicPerlinNoise(seed + '_elevation');
  const continentalNoise = new DeterministicPerlinNoise(seed + '_continental');
  const continentalNoise2 = new DeterministicPerlinNoise(seed + '_continental2');
  const continentalNoise3 = new DeterministicPerlinNoise(seed + '_continental3');
  const coastalNoise = new DeterministicPerlinNoise(seed + '_coastal');
  const temperatureNoise = new DeterministicPerlinNoise(seed + '_temperature');
  const moistureNoise = new DeterministicPerlinNoise(seed + '_moisture');
  
  // Scale factors optimized for 1000x1000 maps with realistic continental patterns
  const continentalScale = 0.001;    // Large scale continental patterns
  const elevationScale = 0.008;      // Regional elevation detail
  const coastalScale = 0.025;        // Coastal complexity
  const temperatureScale = 0.004;
  const moistureScale = 0.015;
  
  // Ocean boundary enforcement - apply early to prevent continental cores near edges
  const distanceFromEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
  const oceanBorderWidth = Math.floor(Math.min(width, height) * 0.05); // 50 pixels for 1000x1000
  
  // Hard boundary enforcement for edges
  if (distanceFromEdge < oceanBorderWidth) {
    // Force ocean at edges - no exceptions
    const elevation = 0.1 + (distanceFromEdge / oceanBorderWidth) * 0.15; // 0.1 to 0.25 range
    return generateClimateAndBiome(x, y, elevation, seed, width, height, temperatureNoise, moistureNoise, temperatureScale, moistureScale);
  }
  
  // Discrete continent placement approach for realistic geography
  // Start with ocean base and build up specific continents
  
  // Define potential continent centers based on seed
  const seedHash = hashSeed(seed);
  const continentConfigs = [];
  
  // Primary continent (always present) - positioned in one quadrant
  const quadrant = seedHash % 4;
  let primary_x, primary_y;
  
  switch (quadrant) {
    case 0: // Northwest
      primary_x = 200 + (seedHash % 150);
      primary_y = 200 + ((seedHash >> 8) % 150);
      break;
    case 1: // Northeast  
      primary_x = 650 + (seedHash % 150);
      primary_y = 200 + ((seedHash >> 8) % 150);
      break;
    case 2: // Southwest
      primary_x = 200 + (seedHash % 150);
      primary_y = 650 + ((seedHash >> 8) % 150);
      break;
    case 3: // Southeast
      primary_x = 650 + (seedHash % 150);
      primary_y = 650 + ((seedHash >> 8) % 150);
      break;
  }
  
  continentConfigs.push({
    centerX: primary_x,
    centerY: primary_y,
    radius: 80 + (seedHash % 40), // Small: 80-120 pixels
    strength: 1.0,
    noiseOffset: 0
  });
  
  // Secondary continent (60% chance) - positioned in opposite corner
  if ((seedHash % 100) < 60) {
    const opposite_quadrant = (quadrant + 2) % 4;
    let secondary_x, secondary_y;
    
    switch (opposite_quadrant) {
      case 0: // Northwest
        secondary_x = 200 + ((seedHash >> 16) % 150);
        secondary_y = 200 + ((seedHash >> 20) % 150);
        break;
      case 1: // Northeast  
        secondary_x = 650 + ((seedHash >> 16) % 150);
        secondary_y = 200 + ((seedHash >> 20) % 150);
        break;
      case 2: // Southwest
        secondary_x = 200 + ((seedHash >> 16) % 150);
        secondary_y = 650 + ((seedHash >> 20) % 150);
        break;
      case 3: // Southeast
        secondary_x = 650 + ((seedHash >> 16) % 150);
        secondary_y = 650 + ((seedHash >> 20) % 150);
        break;
    }
    
    continentConfigs.push({
      centerX: secondary_x,
      centerY: secondary_y,
      radius: 60 + ((seedHash >> 12) % 30), // Smaller: 60-90 pixels
      strength: 0.8,
      noiseOffset: 500
    });
  }
  
  // Very small third continent (20% chance) - in remaining space
  if ((seedHash % 100) < 20) {
    const third_x = 400 + ((seedHash >> 24) % 200);
    const third_y = 400 + ((seedHash >> 28) % 200);
    
    // Check it's not too close to existing continents
    let minSeparation = Infinity;
    for (const config of continentConfigs) {
      const sep = Math.sqrt(Math.pow(third_x - config.centerX, 2) + Math.pow(third_y - config.centerY, 2));
      minSeparation = Math.min(minSeparation, sep);
    }
    
    if (minSeparation > 200) {
      continentConfigs.push({
        centerX: third_x,
        centerY: third_y,
        radius: 40 + (seedHash % 20), // Very small: 40-60 pixels
        strength: 0.6,
        noiseOffset: 1000
      });
    }
  }
  
  // Calculate elevation based on closest continent
  let elevation = 0; // Start with ocean
  
  for (const continent of continentConfigs) {
    const dx = x - continent.centerX;
    const dy = y - continent.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < continent.radius) {
      // Inside continent influence
      const normalizedDistance = distance / continent.radius;
      
      // Create smooth falloff from center to edge
      const baseLandHeight = (1 - Math.pow(normalizedDistance, 2.0)) * continent.strength; // Steeper falloff
      
      // Add fractal detail for realistic coastlines
      const fractalNoise = continentalNoise.octaveNoise(
        (x + continent.noiseOffset) * continentalScale * 2, 
        (y + continent.noiseOffset) * continentalScale * 2, 
        4, 0.5
      );
      
      // Apply fractal variation, strongest at coastlines
      const coastlineVariation = normalizedDistance * (1 - normalizedDistance) * 4; // Peaks at 0.5 distance
      const fractalInfluence = fractalNoise * coastlineVariation * 0.2; // Reduced influence
      
      const continentElevation = Math.max(0, baseLandHeight + fractalInfluence);
      
      // Use the highest elevation from any continent (no blending)
      elevation = Math.max(elevation, continentElevation);
    }
  }
  
  // Calculate fade factor for areas near but not at edges  
  const fadeDistance = oceanBorderWidth * 1.5; // 75 pixel fade zone
  let borderFade = 1;
  if (distanceFromEdge < oceanBorderWidth + fadeDistance) {
    borderFade = Math.min(1, (distanceFromEdge - oceanBorderWidth) / fadeDistance);
    borderFade = Math.pow(borderFade, 1.5); // Stronger fade curve
  }
  
  // Apply border fade
  elevation *= borderFade;
  
  // Regional elevation variations for terrain complexity
  const regionalElevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 6, 0.5);
  
  // Coastal complexity for natural coastlines
  const coastalComplexity = coastalNoise.octaveNoise(x * coastalScale, y * coastalScale, 4, 0.4);
  
  // Add regional detail only to land areas
  if (elevation > 0.2) {
    elevation += regionalElevation * 0.15 + coastalComplexity * 0.1;
  } else {
    // Ocean areas get subtle seafloor variation
    elevation += (regionalElevation + coastalComplexity) * 0.05;
  }
  
  // Normalize elevation to reasonable range
  elevation = Math.max(0, Math.min(1.5, elevation));
  
  // Apply more gradual land/ocean threshold for natural coastlines
  const baseSeaLevel = 0.35;
  
  if (elevation > baseSeaLevel) {
    // Land areas - enhance and add mountain systems
    elevation = baseSeaLevel + (elevation - baseSeaLevel) * 1.4;
    
    // Add mountain ranges on higher continental areas
    if (elevation > 0.65) {
      const mountainNoise = Math.abs(elevationNoise.octaveNoise(x * elevationScale * 2, y * elevationScale * 2, 3, 0.5));
      elevation += mountainNoise * 0.3;
    }
    
    // Ensure land stays above sea level
    elevation = Math.max(elevation, 0.42);
  } else {
    // Ocean areas - create varied seafloor
    elevation = elevation * 0.9;
  }
  
  // Final normalization
  elevation = Math.max(0, Math.min(1, elevation));
  
  return generateClimateAndBiome(x, y, elevation, seed, width, height, temperatureNoise, moistureNoise, temperatureScale, moistureScale);
}

/**
 * Generate climate and biome for a tile given elevation and position
 */
function generateClimateAndBiome(x: number, y: number, elevation: number, seed: string, width: number, height: number, temperatureNoise: DeterministicPerlinNoise, moistureNoise: DeterministicPerlinNoise, temperatureScale: number, moistureScale: number): Tile {
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