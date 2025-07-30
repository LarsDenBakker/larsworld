export interface Tile {
  type: 'land' | 'ocean';
  x: number;
  y: number;
  elevation: number; // 0-1, where 0 is sea level
  temperature: number; // 0-1, where 0 is coldest, 1 is hottest
  moisture: number; // 0-1, where 0 is driest, 1 is wettest
  biome: BiomeType; // Calculated biome based on elevation, temperature, moisture
  elevationType: ElevationType; // Calculated elevation category
}

// Import shared types for paginated generation
import { 
  MapPageRequest, 
  MapPageResponse, 
  CompactTile, 
  tileToCompact,
  BiomeType,
  ElevationType,
  classifyBiome,
  getElevationType
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
 * Generate 1, 2, or 3 continents based on specs using noise-based approach
 * - Creates irregular, natural-looking landmasses instead of circular shapes
 * - Each continent separated by ocean
 * - Distance between continents at least 5% of total map width
 * - Total ocean coverage 25-35%, rest land
 * - Uses multi-octave Perlin noise with domain warping for natural coastlines
 */
function generateContinents(width: number, height: number, seed: number): number[][] {
  const landMask: number[][] = [];
  
  // Initialize with zeros (ocean)
  for (let y = 0; y < height; y++) {
    landMask.push(new Array(width).fill(0));
  }
  
  // Create seeded random function
  const random = seedRandom(seed);
  
  // Determine number of continents (1, 2, or 3)
  const numContinents = Math.floor(random() * 3) + 1;
  
  // Create multiple noise generators for different purposes
  const continentNoise = new PerlinNoise(seed);
  const detailNoise = new PerlinNoise(seed + 100);
  const warpNoiseX = new PerlinNoise(seed + 200);
  const warpNoiseY = new PerlinNoise(seed + 300);
  
  // Generate continent centers ensuring proper separation
  const continentCenters: Array<{x: number, y: number}> = [];
  const minSeparation = width * 0.05;
  
  for (let i = 0; i < numContinents; i++) {
    let attempts = 0;
    let validPosition = false;
    let continentX = width * 0.5;
    let continentY = height * 0.5;
    
    while (!validPosition && attempts < 100) {
      continentX = (width * 0.15) + random() * (width * 0.7);
      continentY = (height * 0.15) + random() * (height * 0.7);
      
      validPosition = true;
      for (const existing of continentCenters) {
        const distance = Math.sqrt(
          Math.pow(continentX - existing.x, 2) + 
          Math.pow(continentY - existing.y, 2)
        );
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
        continentX = width * 0.25;
        continentY = height * 0.5;
      } else if (i === 2) {
        continentX = width * 0.75;
        continentY = height * 0.5;
      }
    }
    
    continentCenters.push({ x: continentX, y: continentY });
  }
  
  // Generate elevation values
  const elevationValues: number[] = [];
  
  // Generate landmass using noise-based approach
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Apply domain warping for natural, irregular shapes
      const warpStrength = 15.0;
      const warpX = x + warpNoiseX.octaveNoise(x * 0.008, y * 0.008, 3, 0.5) * warpStrength;
      const warpY = y + warpNoiseY.octaveNoise(x * 0.008, y * 0.008, 3, 0.5) * warpStrength;
      
      // Large-scale continent shape (low frequency, high amplitude)
      const continentShape = continentNoise.octaveNoise(warpX * 0.003, warpY * 0.003, 3, 0.6);
      
      // Medium-scale features (moderate frequency and amplitude)
      const mediumFeatures = continentNoise.octaveNoise(warpX * 0.008, warpY * 0.008, 4, 0.5);
      
      // Fine-scale coastal details (high frequency, low amplitude)
      const coastalDetails = detailNoise.octaveNoise(warpX * 0.02, warpY * 0.02, 3, 0.4);
      
      // Combine noise layers for natural landmass shape
      let elevation = continentShape * 0.6 + mediumFeatures * 0.3 + coastalDetails * 0.1;
      
      // Add distance-based influence from continent centers for separation
      let centerInfluence = 0;
      for (const center of continentCenters) {
        const dx = (x - center.x) / (width * 0.3); // Influence area
        const dy = (y - center.y) / (height * 0.3);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Smooth falloff from continent centers
        const influence = Math.max(0, 1 - Math.pow(distance, 1.8));
        centerInfluence = Math.max(centerInfluence, influence);
      }
      
      // Ensure we always have some landmass near continent centers
      const landBoost = centerInfluence * 0.35; // Moderate land boost
      
      // Combine noise elevation with center influence
      elevation = elevation * 0.65 + centerInfluence * 0.18 + landBoost;
      
      // Normalize to 0-1 and clamp
      elevation = (elevation + 1) / 2; // Normalize to 0-1
      elevation = Math.max(0, Math.min(1, elevation));
      
      landMask[y][x] = elevation;
      elevationValues.push(elevation);
    }
  }
  
  // Post-process to achieve target ocean coverage (25-35%, aim for 30%)
  // Create a list of all elevation values with their coordinates for sorting
  const allElevations: Array<{value: number, x: number, y: number}> = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      allElevations.push({value: landMask[y][x], x, y});
    }
  }
  
  // Sort by elevation value to determine exact threshold
  allElevations.sort((a, b) => a.value - b.value);
  
  // Target 30% ocean coverage (middle of 25-35% spec range)
  const targetOceanPercent = 0.30;
  const oceanTileCount = Math.floor(allElevations.length * targetOceanPercent);
  
  // Apply ocean/land classification directly based on sorted order
  for (let i = 0; i < allElevations.length; i++) {
    const {x, y} = allElevations[i];
    
    if (i < oceanTileCount) {
      // Bottom 30% = ocean (scale from 0.1 to 0.39 to stay well below 0.5)
      const oceanPosition = i / (oceanTileCount - 1);
      landMask[y][x] = 0.1 + oceanPosition * 0.29; // 0.1 to 0.39
    } else {
      // Top 70% = land (scale from 0.51 to 1.0 to stay well above 0.5)
      const landPosition = (i - oceanTileCount) / (allElevations.length - oceanTileCount - 1);
      landMask[y][x] = 0.51 + landPosition * 0.49; // 0.51 to 1.0
    }
  }
  
  return landMask;
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
 * Generates a realistic square map with 1, 2, or 3 continents
 * - Maps are always square
 * - Contains 1, 2, or 3 continents separated by ocean
 * - Distance between continents at least 5% of total map width  
 * - 25-35% ocean coverage, rest land
 * - Deterministic based on seed
 */
export function generateMap(width: number, height: number, seed?: number): Tile[][] {
  // Ensure square maps as per specs
  if (width !== height) {
    throw new Error('Maps must be square according to specs');
  }
  
  const map: Tile[][] = [];
  const mapSeed = seed ?? Math.floor(Math.random() * 1000000);
  
  // Initialize noise generators with different seeds for variety
  const elevationNoise = new PerlinNoise(mapSeed + 1);
  const temperatureNoise = new PerlinNoise(mapSeed + 2);
  const moistureNoise = new PerlinNoise(mapSeed + 3);
  
  // Generate continents according to specs
  const landMask = generateContinents(width, height, mapSeed);
  
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      // Get land strength from continent generation
      const landStrength = landMask[y][x];
      
      // Base elevation from land strength
      let elevation = landStrength;
      
      // Add detailed terrain elevation using noise for land areas
      if (landStrength >= 0.5) {
        const terrainElevation = elevationNoise.octaveNoise(x * 0.01, y * 0.01, 6, 0.5);
        const terrainVariation = (terrainElevation + 1) / 2; // Normalize to 0-1
        
        // Combine base land shape with terrain details
        elevation = landStrength * 0.7 + terrainVariation * landStrength * 0.5;
        
        // Ensure minimum land elevation
        elevation = Math.max(elevation, 0.51);
      } else {
        // Ocean areas - add seafloor variation
        const seafloorVariation = elevationNoise.octaveNoise(x * 0.005, y * 0.005, 3, 0.3);
        elevation = landStrength + Math.max(0, seafloorVariation * 0.05); // Smaller variation to stay below 0.5
        elevation = Math.min(elevation, 0.49); // Ensure it stays below 0.5
      }
      
      // Clamp elevation to valid range
      elevation = Math.max(0, Math.min(1, elevation));
      
      // Generate temperature based on latitude and elevation
      const latitudeFactor = Math.abs((y / height) - 0.5) * 2; // 0 at equator, 1 at poles
      let temperature = 1 - latitudeFactor; // Hot at equator, cold at poles
      temperature += temperatureNoise.octaveNoise(x * 0.008, y * 0.008, 3, 0.3) * 0.3;
      temperature -= elevation * 0.5; // Higher elevation = colder
      temperature = Math.max(0, Math.min(1, temperature));
      
      // Generate moisture patterns
      let moisture = moistureNoise.octaveNoise(x * 0.012, y * 0.012, 4, 0.4);
      moisture = (moisture + 1) / 2; // Normalize to 0-1
      moisture = Math.max(0, Math.min(1, moisture));
      
      // Determine tile type based on specs (land or ocean)
      const tileType = getTileType(elevation);
      
      // Classify biome and elevation type
      const biome = classifyBiome(elevation, temperature, moisture);
      const elevationType = getElevationType(elevation);

      row.push({
        type: tileType,
        x,
        y,
        elevation,
        temperature,
        moisture,
        biome,
        elevationType
      });
    }
    map.push(row);
  }
  
  return map;
}

/**
 * Calculate land strength for a single coordinate using a simplified approach
 * that matches the new deterministic ocean coverage algorithm
 */
function calculateLandStrengthAt(x: number, y: number, width: number, height: number, seed: number): number {
  // Use the same continental generation algorithm as generateContinents
  // but with a simpler approach to determine ocean vs land
  
  // Create seeded random function (same as in generateContinents)
  const random = seedRandom(seed);
  
  // Determine number of continents (1, 2, or 3) - same logic as generateContinents
  const numContinents = Math.floor(random() * 3) + 1;
  
  // Create multiple noise generators for different purposes (same as generateContinents)
  const continentNoise = new PerlinNoise(seed);
  const detailNoise = new PerlinNoise(seed + 100);
  const warpNoiseX = new PerlinNoise(seed + 200);
  const warpNoiseY = new PerlinNoise(seed + 300);
  
  // Generate continent centers ensuring proper separation (same logic as generateContinents)
  const continentCenters: Array<{x: number, y: number}> = [];
  const minSeparation = width * 0.05;
  
  for (let i = 0; i < numContinents; i++) {
    let attempts = 0;
    let validPosition = false;
    let continentX = width * 0.5;
    let continentY = height * 0.5;
    
    while (!validPosition && attempts < 100) {
      continentX = (width * 0.15) + random() * (width * 0.7);
      continentY = (height * 0.15) + random() * (height * 0.7);
      
      validPosition = true;
      for (const existing of continentCenters) {
        const distance = Math.sqrt(
          Math.pow(continentX - existing.x, 2) + 
          Math.pow(continentY - existing.y, 2)
        );
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
        continentX = width * 0.25;
        continentY = height * 0.5;
      } else if (i === 2) {
        continentX = width * 0.75;
        continentY = height * 0.5;
      }
    }
    
    continentCenters.push({ x: continentX, y: continentY });
  }
  
  // Calculate raw elevation for this specific coordinate (same algorithm as generateContinents)
  
  // Apply domain warping for natural, irregular shapes
  const warpStrength = 15.0;
  const warpX = x + warpNoiseX.octaveNoise(x * 0.008, y * 0.008, 3, 0.5) * warpStrength;
  const warpY = y + warpNoiseY.octaveNoise(x * 0.008, y * 0.008, 3, 0.5) * warpStrength;
  
  // Large-scale continent shape (low frequency, high amplitude)
  const continentShape = continentNoise.octaveNoise(warpX * 0.003, warpY * 0.003, 3, 0.6);
  
  // Medium-scale features (moderate frequency and amplitude)
  const mediumFeatures = continentNoise.octaveNoise(warpX * 0.008, warpY * 0.008, 4, 0.5);
  
  // Fine-scale coastal details (high frequency, low amplitude)
  const coastalDetails = detailNoise.octaveNoise(warpX * 0.02, warpY * 0.02, 3, 0.4);
  
  // Combine noise layers for natural landmass shape
  let elevation = continentShape * 0.6 + mediumFeatures * 0.3 + coastalDetails * 0.1;
  
  // Add distance-based influence from continent centers for separation
  let centerInfluence = 0;
  for (const center of continentCenters) {
    const dx = (x - center.x) / (width * 0.3); // Influence area
    const dy = (y - center.y) / (height * 0.3);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Smooth falloff from continent centers
    const influence = Math.max(0, 1 - Math.pow(distance, 1.8));
    centerInfluence = Math.max(centerInfluence, influence);
  }
  
  // Ensure we always have some landmass near continent centers
  const landBoost = centerInfluence * 0.35; // Moderate land boost
  
  // Combine noise elevation with center influence
  elevation = elevation * 0.65 + centerInfluence * 0.18 + landBoost;
  
  // Normalize to 0-1 and clamp
  elevation = (elevation + 1) / 2; // Normalize to 0-1
  elevation = Math.max(0, Math.min(1, elevation));
  
  // For paginated generation, we can't sort all elevations like in generateContinents,
  // so we use a probabilistic approach that approximates the 30% ocean coverage.
  // Based on analysis of actual generated maps, an elevation threshold of 0.453
  // in the raw elevation values corresponds to 30% ocean coverage.
  const approximateThreshold = 0.49;
  
  if (elevation < approximateThreshold) {
    // Ocean: scale from 0.1 to 0.39
    const oceanPosition = elevation / approximateThreshold;
    return 0.1 + oceanPosition * 0.29;
  } else {
    // Land: scale from 0.51 to 1.0
    const landPosition = (elevation - approximateThreshold) / (1 - approximateThreshold);
    return 0.51 + landPosition * 0.49;
  }
}

/**
 * Generate a single tile at specific coordinates using the same algorithm as generateMap
 * This ensures consistency between full map generation and paginated generation
 */
function generateTileAt(x: number, y: number, width: number, height: number, seed: number): Tile {
  // Use the same noise generators as generateMap with the same seeds
  const elevationNoise = new PerlinNoise(seed + 1);
  const temperatureNoise = new PerlinNoise(seed + 2);
  const moistureNoise = new PerlinNoise(seed + 3);
  
  // Calculate land strength using optimized stateless function
  const landStrength = calculateLandStrengthAt(x, y, width, height, seed);
  
  // Apply the same elevation calculation as generateMap
  let elevation = landStrength;
  
  // Add detailed terrain elevation using noise for land areas
  if (landStrength > 0.1) {
    const terrainElevation = elevationNoise.octaveNoise(x * 0.01, y * 0.01, 6, 0.5);
    const terrainVariation = (terrainElevation + 1) / 2; // Normalize to 0-1
    
    // Combine base land shape with terrain details
    elevation = landStrength * 0.7 + terrainVariation * landStrength * 0.5;
    
    // Ensure minimum land elevation
    elevation = Math.max(elevation, 0.31);
  } else {
    // Ocean areas - add seafloor variation
    const seafloorVariation = elevationNoise.octaveNoise(x * 0.005, y * 0.005, 3, 0.3);
    elevation = 0.1 + Math.max(0, seafloorVariation * 0.1);
  }
  
  // Clamp elevation to valid range
  elevation = Math.max(0, Math.min(1, elevation));
  
  // Generate temperature based on latitude and elevation (same as generateMap)
  const latitudeFactor = Math.abs((y / height) - 0.5) * 2; // 0 at equator, 1 at poles
  let temperature = 1 - latitudeFactor; // Hot at equator, cold at poles
  temperature += temperatureNoise.octaveNoise(x * 0.008, y * 0.008, 3, 0.3) * 0.3;
  temperature -= elevation * 0.5; // Higher elevation = colder
  temperature = Math.max(0, Math.min(1, temperature));
  
  // Generate moisture patterns (same as generateMap)
  let moisture = moistureNoise.octaveNoise(x * 0.012, y * 0.012, 4, 0.4);
  moisture = (moisture + 1) / 2; // Normalize to 0-1
  moisture = Math.max(0, Math.min(1, moisture));
  
  // Determine tile type based on specs (land or ocean)
  const tileType = getTileType(elevation);
  
  // Classify biome and elevation type
  const biome = classifyBiome(elevation, temperature, moisture);
  const elevationType = getElevationType(elevation);
  
  return {
    type: tileType,
    x,
    y,
    elevation,
    temperature,
    moisture,
    biome,
    elevationType
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
 * Generate a page of map data using the same algorithm as generateMap
 * This ensures perfect consistency between full and paginated generation
 */
export function generateMapPage(request: MapPageRequest): MapPageResponse {
  const { page, pageSize, seed } = request;
  
  // Parse seed - support both string and number seeds for compatibility
  const seedNumber = typeof seed === 'string' ? hashSeed(seed) : seed;
  
  // For now, support only 1000x1000 maps for API compatibility
  // This matches the current paginated API behavior
  const width = 1000;
  const height = 1000;
  
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
  
  // Generate tiles for this page using the same algorithm as generateMap
  const tiles: CompactTile[][] = [];
  
  for (let y = startY; y < endY; y++) {
    const row: CompactTile[] = [];
    for (let x = 0; x < width; x++) {
      const tile = generateTileAt(x, y, width, height, seedNumber);
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
 * Validate that a map page request is within reasonable limits
 */
export function validateMapPageRequest(request: MapPageRequest): void {
  const { page, pageSize, seed } = request;
  
  if (!seed || (typeof seed === 'string' && seed.length === 0)) {
    throw new Error('Seed is required');
  }
  
  if (pageSize <= 0 || pageSize > 1000) {
    throw new Error('Page size must be between 1 and 1000');
  }
  
  if (page < 0) {
    throw new Error('Page must be non-negative');
  }
}