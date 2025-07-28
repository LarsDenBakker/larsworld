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
 * Updated for clearer ocean/land separation and new water types
 */
function getBiome(temperature: number, moisture: number, elevation: number, isRiver: boolean = false, isLake: boolean = false): BiomeType {
  // Rivers and lakes override other biomes (except ocean)
  if (isRiver && elevation >= 0.2) return 'river';
  if (isLake && elevation >= 0.25) return 'lake';
  
  // Ocean and shallow water based on elevation - adjusted for clearer separation
  if (elevation < 0.3) {
    return elevation < 0.2 ? 'ocean' : 'shallow_water';
  }
  
  // Beach areas just above water - narrower band for clearer separation
  if (elevation < 0.35) {
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
 * Enhanced for realistic continental patterns and configurable map size
 */
function generateTileAt(x: number, y: number, width: number, height: number, seed: string, rivers: Set<string>, lakes: Set<string>): Tile {
  const coordKey = `${x},${y}`;
  const isRiver = rivers.has(coordKey);
  const isLake = lakes.has(coordKey);
  
  // Create noise generators with seed-based deterministic values
  const elevationNoise = new DeterministicPerlinNoise(seed + '_elevation');
  const continentalNoise = new DeterministicPerlinNoise(seed + '_continental');
  const coastalNoise = new DeterministicPerlinNoise(seed + '_coastal');
  const temperatureNoise = new DeterministicPerlinNoise(seed + '_temperature');
  const moistureNoise = new DeterministicPerlinNoise(seed + '_moisture');
  
  // Enhanced continental generation for different map sizes
  const continentalNoise2 = new DeterministicPerlinNoise(seed + '_continental2');
  
  // Scale factors adjusted based on map size for consistent continental patterns
  const baseScale = Math.max(width, height);
  const continentalScale = 1.5 / baseScale; // Larger continental patterns for fewer, bigger continents
  const continentalScale2 = 1.8 / baseScale; // Slightly different scale for variation
  const elevationScale = 8 / baseScale;
  const coastalScale = 25 / baseScale; // More coastal complexity
  const temperatureScale = 4 / baseScale;
  const moistureScale = 15 / baseScale;

  let elevation = 0;
  
  // Enhanced island/planet falloff - ensure ocean boundaries
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
  const falloffFactor = Math.max(0, 1 - (distanceFromCenter / maxDistance) ** 1.5);
  
  // Create realistic continental patterns - aim for ~40% land coverage
  
  // Primary continental structure - creates main landmass distribution
  const continentalPattern1 = continentalNoise.octaveNoise(x * continentalScale, y * continentalScale, 3, 0.6);
  
  // Secondary continental structure - creates additional continents
  const continentalPattern2 = continentalNoise2.octaveNoise(
    (x + width * 0.5) * continentalScale2, // Offset to create different pattern
    (y + height * 0.3) * continentalScale2, 
    3, 0.5
  );
  
  // Regional elevation variations
  const regionalElevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 6, 0.5);
  
  // Coastal complexity for realistic coastlines
  const coastalComplexity = coastalNoise.octaveNoise(x * coastalScale, y * coastalScale, 4, 0.4);
  
  // Combine continental patterns with island falloff
  const mainContinental = Math.max(continentalPattern1 * 0.8, continentalPattern2 * 0.6) * falloffFactor;
  
  // Combine all elevation sources
  let baseLand = mainContinental + regionalElevation * 0.2 + coastalComplexity * 0.12;
  
  // Normalize to 0-1 range
  elevation = (baseLand + 1) / 2;
  
  // Apply power curve to create clearer land/ocean distinction
  elevation = Math.pow(elevation, 1.1);
  
  // Threshold adjustment for ~40% land coverage with island falloff
  const landThreshold = 0.25;
  
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
  
  // Determine biome based on climate and elevation
  const biome = getBiome(temperature, moisture, elevation, isRiver, isLake);
  
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
 * Simple river network generation based on elevation gradients
 * Rivers flow from high elevation to low elevation (toward ocean)
 */
function generateRiverNetwork(elevationMap: number[][], width: number, height: number, seed: string): { rivers: Set<string>, lakes: Set<string> } {
  const rivers = new Set<string>();
  const lakes = new Set<string>();
  const riverNoise = new DeterministicPerlinNoise(seed + '_rivers');
  
  // Helper function to get elevation at coordinates
  const getElevation = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return elevationMap[y][x];
  };
  
  // Helper to encode coordinates as string
  const coordKey = (x: number, y: number) => `${x},${y}`;
  
  // Find potential river sources (high elevation areas)
  const riverSources: Array<{x: number, y: number, elevation: number}> = [];
  
  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 8) {
    for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 8) {
      const elevation = getElevation(x, y);
      
      // Only start rivers from reasonably high elevation
      if (elevation > 0.6) {
        // Use noise to determine if this should be a river source
        const riverChance = riverNoise.noise(x * 0.01, y * 0.01);
        if (riverChance > 0.3) {
          riverSources.push({ x, y, elevation });
        }
      }
    }
  }
  
  // Sort sources by elevation (highest first)
  riverSources.sort((a, b) => b.elevation - a.elevation);
  
  // Limit number of river sources to prevent overcrowding
  const maxRivers = Math.min(8, Math.floor(Math.sqrt(width * height) / 50));
  const selectedSources = riverSources.slice(0, maxRivers);
  
  // Generate rivers from each source
  for (const source of selectedSources) {
    let currentX = source.x;
    let currentY = source.y;
    const visited = new Set<string>();
    const riverPath: Array<{x: number, y: number}> = [];
    
    // Follow downhill gradient to create river
    for (let step = 0; step < 200; step++) {
      const key = coordKey(currentX, currentY);
      
      if (visited.has(key)) break; // Avoid loops
      visited.add(key);
      
      const currentElevation = getElevation(currentX, currentY);
      
      // Stop if we reach ocean level
      if (currentElevation < 0.25) break;
      
      riverPath.push({ x: currentX, y: currentY });
      
      // Find steepest downhill direction
      let bestX = currentX;
      let bestY = currentY;
      let bestElevation = currentElevation;
      
      // Check 8 directions
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          const nextElevation = getElevation(nextX, nextY);
          
          // Find the lowest adjacent elevation
          if (nextElevation < bestElevation) {
            bestX = nextX;
            bestY = nextY;
            bestElevation = nextElevation;
          }
        }
      }
      
      // If no downhill path found, this might be a lake location
      if (bestX === currentX && bestY === currentY) {
        if (currentElevation > 0.35 && currentElevation < 0.7) {
          lakes.add(key);
        }
        break;
      }
      
      currentX = bestX;
      currentY = bestY;
    }
    
    // Add river path to rivers set
    for (const point of riverPath) {
      rivers.add(coordKey(point.x, point.y));
    }
  }
  
  return { rivers, lakes };
}

/**
 * Calculate optimal page size based on map dimensions
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
 * Generate a page of map data using stateless, deterministic generation with configurable map size
 */
export function generateMapPage(request: MapPageRequest): MapPageResponse {
  const { page, pageSize, seed, width = 1000, height = 1000 } = request;
  
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
  
  // Generate elevation map for the entire area needed for this page (for river calculation)
  // We need a broader context for river generation
  const contextStartY = Math.max(0, startY - 50);
  const contextEndY = Math.min(height, endY + 50);
  const elevationMap: number[][] = [];
  
  for (let y = contextStartY; y < contextEndY; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      // Generate just elevation for river calculation
      const tempTile = generateTileAt(x, y, width, height, seed, new Set(), new Set());
      row.push(tempTile.elevation);
    }
    elevationMap.push(row);
  }
  
  // Generate rivers and lakes for this context area
  const { rivers, lakes } = generateRiverNetwork(elevationMap, width, contextEndY - contextStartY, seed);
  
  // Adjust river/lake coordinates to global coordinates
  const globalRivers = new Set<string>();
  const globalLakes = new Set<string>();
  
  rivers.forEach(coord => {
    const [x, localY] = coord.split(',').map(Number);
    const globalY = localY + contextStartY;
    globalRivers.add(`${x},${globalY}`);
  });
  
  lakes.forEach(coord => {
    const [x, localY] = coord.split(',').map(Number);
    const globalY = localY + contextStartY;
    globalLakes.add(`${x},${globalY}`);
  });
  
  // Generate tiles for this page
  const tiles: CompactTile[][] = [];
  
  for (let y = startY; y < endY; y++) {
    const row: CompactTile[] = [];
    for (let x = 0; x < width; x++) {
      const tile = generateTileAt(x, y, width, height, seed, globalRivers, globalLakes);
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
  const { page, pageSize, seed, width = 1000, height = 1000 } = request;
  
  if (!seed || seed.length === 0) {
    throw new Error('Seed is required');
  }
  
  if (pageSize <= 0 || pageSize > 1000) {
    throw new Error('Page size must be between 1 and 1000');
  }
  
  if (page < 0) {
    throw new Error('Page must be non-negative');
  }
  
  if (width < 100 || width > 2000) {
    throw new Error('Width must be between 100 and 2000');
  }
  
  if (height < 100 || height > 2000) {
    throw new Error('Height must be between 100 and 2000');
  }
}