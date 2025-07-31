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
  lake: boolean; // Whether this tile contains a lake
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
 * Calculate the flow direction based on elevation gradients and natural meandering
 * Returns the direction water would flow from this tile
 */
function calculateFlowDirection(x: number, y: number, seed: number): { dx: number, dy: number } {
  // Check all 8 neighboring directions for more natural flow
  const directions = [
    { dx: 0, dy: -1 },  // North
    { dx: 1, dy: -1 },  // Northeast
    { dx: 1, dy: 0 },   // East
    { dx: 1, dy: 1 },   // Southeast
    { dx: 0, dy: 1 },   // South
    { dx: -1, dy: 1 },  // Southwest
    { dx: -1, dy: 0 },  // West
    { dx: -1, dy: -1 }  // Northwest
  ];
  
  const currentElevation = calculateLandStrengthAtChunk(x, y, seed);
  let bestDirection = { dx: 0, dy: 0 };
  let bestScore = -1;
  
  // Add some randomness for natural meandering using cached noise
  const riverNoise = getRiverNoiseGenerators(seed);
  const meanderValue = riverNoise.meander.noise(x * 0.05, y * 0.05);
  
  for (const dir of directions) {
    const neighborX = x + dir.dx;
    const neighborY = y + dir.dy;
    const neighborElevation = calculateLandStrengthAtChunk(neighborX, neighborY, seed);
    
    const elevationDrop = currentElevation - neighborElevation;
    
    // Only consider downward flow
    if (elevationDrop <= 0) continue;
    
    // Calculate flow score considering elevation drop and meandering
    let flowScore = elevationDrop;
    
    // Add slight preference for cardinal directions (more natural)
    if (dir.dx === 0 || dir.dy === 0) {
      flowScore *= 1.1;
    }
    
    // Add meandering influence based on direction
    const directionIndex = directions.indexOf(dir);
    const meanderInfluence = Math.sin(meanderValue * 8 + directionIndex) * 0.1;
    flowScore += meanderInfluence;
    
    if (flowScore > bestScore) {
      bestScore = flowScore;
      bestDirection = dir;
    }
  }
  
  return bestDirection;
}

/**
 * Cached river system data for each seed
 */
interface RiverSystemData {
  riverSources: Array<{x: number, y: number}>;
  riverPaths: Map<string, RiverType>; // "x,y" -> RiverType
  lakes: Set<string>; // "x,y" for lake locations
  standaloneLakes: Array<{x: number, y: number, radius: number}>; // Standalone lakes not connected to rivers
}

const riverSystemCache = new Map<number, RiverSystemData>();

/**
 * Get or generate river system data for a seed
 */
function getRiverSystemData(seed: number): RiverSystemData {
  if (riverSystemCache.has(seed)) {
    return riverSystemCache.get(seed)!;
  }
  
  const riverSources: Array<{x: number, y: number}> = [];
  const riverPaths = new Map<string, RiverType>();
  const lakes = new Set<string>();
  const standaloneLakes: Array<{x: number, y: number, radius: number}> = [];
  
  // Generate river sources with proper spacing
  const random = seedRandom(seed + 9999);
  const riverNoise = getRiverNoiseGenerators(seed);
  
  // Use a much larger reference area to cover any potential chunk generation
  const refWidth = 5000;
  const refHeight = 5000;
  const refOffsetX = -2500; // Center the reference area around origin
  const refOffsetY = -2500;
  const minSourceSpacing = 60; // Reduced from 80 to increase river frequency
  
  // Scan for potential river sources in high-elevation areas
  const potentialSources: Array<{x: number, y: number, suitability: number}> = [];
  
  for (let y = refOffsetY; y < refOffsetY + refHeight; y += 12) { // Reduced from 15 to increase density
    for (let x = refOffsetX; x < refOffsetX + refWidth; x += 12) {
      const elevation = calculateLandStrengthAtChunk(x, y, seed);
      
      // Only consider land tiles at higher elevations
      if (elevation < 0.52) continue; // Lowered threshold from 0.54 to increase sources
      
      // Calculate suitability based on elevation and local terrain
      const relativeElevation = (elevation - 0.5) / 0.5; // 0-1 within land range
      const sourceNoise = riverNoise.source.octaveNoise(x * 0.006, y * 0.006, 3, 0.6);
      const suitability = relativeElevation * 0.7 + (sourceNoise + 1) * 0.15;
      
      if (suitability > 0.4) { // Lower suitability threshold to get more sources
        potentialSources.push({ x, y, suitability });
      }
    }
  }
  
  // Sort by suitability and select sources with spacing constraints
  potentialSources.sort((a, b) => b.suitability - a.suitability);
  
  for (const candidate of potentialSources) {
    // Check spacing constraint
    let tooClose = false;
    for (const existing of riverSources) {
      const dx = candidate.x - existing.x;
      const dy = candidate.y - existing.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minSourceSpacing) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose && riverSources.length < 60) { // Increased from 40 to allow more rivers
      riverSources.push({ x: candidate.x, y: candidate.y });
    }
  }
  
  // Generate river paths from each source with lake endpoints
  for (const source of riverSources) {
    generateRiverPath(source.x, source.y, seed, riverPaths, lakes, random);
  }
  
  // Generate standalone lakes not connected to rivers
  generateStandaloneLakes(seed, refWidth, refHeight, refOffsetX, refOffsetY, standaloneLakes, riverPaths, random);
  
  const systemData: RiverSystemData = {
    riverSources,
    riverPaths,
    lakes,
    standaloneLakes
  };
  
  riverSystemCache.set(seed, systemData);
  return systemData;
}

/**
 * Generate a single river path from a source to ocean/lake
 */
function generateRiverPath(startX: number, startY: number, seed: number, riverPaths: Map<string, RiverType>, lakes: Set<string>, random: () => number): void {
  const visited = new Set<string>();
  let currentX = startX;
  let currentY = startY;
  const path: Array<{x: number, y: number, flow: {dx: number, dy: number}}> = [];
  
  // Follow elevation gradients to create river path
  for (let step = 0; step < 300; step++) { // Increased from 200 to make rivers longer
    const key = `${currentX},${currentY}`;
    
    // Stop if we've been here before (loop prevention)
    if (visited.has(key)) break;
    visited.add(key);
    
    const elevation = calculateLandStrengthAtChunk(currentX, currentY, seed);
    
    // Stop if we reach ocean
    if (elevation < 0.5) break;
    
    // Calculate flow direction
    const flowDirection = calculateFlowDirection(currentX, currentY, seed);
    
    // Stop if no clear flow direction (local minimum)
    if (flowDirection.dx === 0 && flowDirection.dy === 0) {
      // Create a lake at this dead end if the river is long enough
      if (path.length > 15) {
        createLake(currentX, currentY, lakes, 2 + Math.floor(random() * 3), seed); // Lake radius 2-4
      }
      break;
    }
    
    // Record this segment
    path.push({ x: currentX, y: currentY, flow: flowDirection });
    
    // Random chance to create a lake midway through longer rivers
    if (path.length > 20 && path.length % 30 === 0 && random() < 0.3) {
      createLake(currentX, currentY, lakes, 1 + Math.floor(random() * 2), seed); // Smaller midway lakes
    }
    
    // Move to next position
    currentX += flowDirection.dx;
    currentY += flowDirection.dy;
  }
  
  // Create a lake at the river mouth if it doesn't reach ocean and is long enough
  if (path.length > 25) {
    const lastSegment = path[path.length - 1];
    const finalElevation = calculateLandStrengthAtChunk(lastSegment.x, lastSegment.y, seed);
    if (finalElevation >= 0.5 && random() < 0.4) { // 40% chance of lake at river mouth
      createLake(lastSegment.x, lastSegment.y, lakes, 3 + Math.floor(random() * 3), seed); // Larger mouth lakes
    }
  }
  
  // Convert path to river segments
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const key = `${segment.x},${segment.y}`;
    
    // Determine river segment type based on flow direction
    const flow = segment.flow;
    let riverType: RiverType = 'none';
    
    if (flow.dy === 0) {
      // Pure horizontal flow
      riverType = 'horizontal';
    } else if (flow.dx === 0) {
      // Pure vertical flow
      riverType = 'vertical';
    } else {
      // Diagonal flow - use appropriate bend segments
      if (flow.dx > 0 && flow.dy > 0) {
        riverType = 'bend_se';
      } else if (flow.dx > 0 && flow.dy < 0) {
        riverType = 'bend_ne';
      } else if (flow.dx < 0 && flow.dy > 0) {
        riverType = 'bend_sw';
      } else {
        riverType = 'bend_nw';
      }
    }
    
    riverPaths.set(key, riverType);
  }
}

/**
 * Create a lake at the specified location with given radius
 */
function createLake(centerX: number, centerY: number, lakes: Set<string>, radius: number, seed: number = 12345): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= radius) {
        const x = centerX + dx;
        const y = centerY + dy;
        const elevation = calculateLandStrengthAtChunk(x, y, seed);
        
        // Only create lakes on land areas
        if (elevation >= 0.5) {
          lakes.add(`${x},${y}`);
        }
      }
    }
  }
}

/**
 * Generate standalone lakes not connected to rivers
 */
function generateStandaloneLakes(seed: number, refWidth: number, refHeight: number, refOffsetX: number, refOffsetY: number, 
                                standaloneLakes: Array<{x: number, y: number, radius: number}>, 
                                riverPaths: Map<string, RiverType>, random: () => number): void {
  const lakeNoise = new PerlinNoise(seed + 8000);
  
  // Generate fewer but well-spaced standalone lakes
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = refOffsetX + Math.floor(random() * refWidth);
    const y = refOffsetY + Math.floor(random() * refHeight);
    const elevation = calculateLandStrengthAtChunk(x, y, seed);
    
    // Only place lakes on suitable land areas
    if (elevation < 0.5 || elevation > 0.65) continue;
    
    // Check distance from existing rivers and lakes
    let tooCloseToRiver = false;
    const checkRadius = 20;
    for (let dy = -checkRadius; dy <= checkRadius; dy++) {
      for (let dx = -checkRadius; dx <= checkRadius; dx++) {
        const checkKey = `${x + dx},${y + dy}`;
        if (riverPaths.has(checkKey)) {
          tooCloseToRiver = true;
          break;
        }
      }
      if (tooCloseToRiver) break;
    }
    
    if (tooCloseToRiver) continue;
    
    // Check distance from other lakes
    let tooCloseToLake = false;
    for (const existingLake of standaloneLakes) {
      const dx = x - existingLake.x;
      const dy = y - existingLake.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 40) {
        tooCloseToLake = true;
        break;
      }
    }
    
    if (tooCloseToLake) continue;
    
    // Use noise to determine lake suitability
    const lakeNoiseval = lakeNoise.octaveNoise(x * 0.01, y * 0.01, 3, 0.5);
    if (lakeNoiseval > 0.2) {
      const radius = 2 + Math.floor(random() * 4); // Radius 2-5
      standaloneLakes.push({ x, y, radius });
    }
  }
}

/**
 * Determine if a location should be a river source
 * Now uses the cached river system data
 */
function isRiverSource(x: number, y: number, seed: number): boolean {
  const riverSystem = getRiverSystemData(seed);
  
  // Check if this location is one of the pre-generated river sources
  for (const source of riverSystem.riverSources) {
    if (source.x === x && source.y === y) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate realistic flow accumulation using cached river system
 * Now much simpler - just check if this tile is part of a river path
 */
function calculateFlowAccumulation(x: number, y: number, seed: number): number {
  const riverSystem = getRiverSystemData(seed);
  const key = `${x},${y}`;
  
  // If this tile is part of a river path, return high accumulation
  if (riverSystem.riverPaths.has(key)) {
    return 5.0; // High value to ensure river generation
  }
  
  return 0.0; // No accumulation for non-river tiles
}

/**
 * Determine if a location is a lake
 */
function isLake(x: number, y: number, seed: number): boolean {
  const riverSystem = getRiverSystemData(seed);
  
  // Check if this location is a lake from the river system
  const key = `${x},${y}`;
  if (riverSystem.lakes.has(key)) {
    return true;
  }
  
  // Check if this location is part of a standalone lake
  for (const lake of riverSystem.standaloneLakes) {
    const dx = x - lake.x;
    const dy = y - lake.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= lake.radius) {
      const elevation = calculateLandStrengthAtChunk(x, y, seed);
      // Only create lakes on land areas
      if (elevation >= 0.5) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Determine the river segment type based on cached river system data
 */
function calculateRiverType(x: number, y: number, seed: number): RiverType {
  const elevation = calculateLandStrengthAtChunk(x, y, seed);
  
  // No rivers in ocean
  if (elevation < 0.5) return 'none';
  
  const riverSystem = getRiverSystemData(seed);
  const key = `${x},${y}`;
  
  // Return the pre-calculated river type for this tile
  return riverSystem.riverPaths.get(key) || 'none';
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
  
  // Large-scale continent shape (low frequency, high amplitude)
  const continentShape = noiseGenerators.continent.octaveNoise(warpX * 0.003, warpY * 0.003, 3, 0.6);
  
  // Medium-scale features (moderate frequency and amplitude)
  const mediumFeatures = noiseGenerators.continent.octaveNoise(warpX * 0.008, warpY * 0.008, 4, 0.5);
  
  // Fine-scale coastal details (high frequency, low amplitude)
  const coastalDetails = noiseGenerators.detail.octaveNoise(warpX * 0.02, warpY * 0.02, 3, 0.4);
  
  // Combine noise layers for natural landmass shape
  let elevation = continentShape * 0.6 + mediumFeatures * 0.3 + coastalDetails * 0.1;
  
  // Add distance-based influence from continent centers for separation
  let centerInfluence = 0;
  for (const center of centers) {
    const dx = (x - center.x) / (referenceWidth * 0.3); // Influence area
    const dy = (y - center.y) / (referenceHeight * 0.3);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Smooth falloff from continent centers
    const influence = Math.max(0, 1 - Math.pow(distance, 1.8));
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
 * Optimized noise generators cache for rivers
 */
interface RiverNoiseGenerators {
  drainage: PerlinNoise;
  watershed: PerlinNoise;
  source: PerlinNoise;
  meander: PerlinNoise;
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
    drainage: new PerlinNoise(seed + 2000),
    watershed: new PerlinNoise(seed + 3000),
    source: new PerlinNoise(seed + 1000),
    meander: new PerlinNoise(seed + 5000)
  };
  
  riverNoiseCache.set(seed, noiseGenerators);
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
  
  // Add detailed terrain elevation using noise for land areas
  if (landStrength >= 0.5) {
    const terrainElevation = noiseGenerators.elevation.octaveNoise(x * 0.01, y * 0.01, 6, 0.5);
    const terrainVariation = (terrainElevation + 1) / 2; // Normalize to 0-1
    
    // Combine base land shape with terrain details
    elevation = landStrength * 0.7 + terrainVariation * landStrength * 0.5;
    
    // Ensure minimum land elevation
    elevation = Math.max(elevation, 0.51);
  } else {
    // Ocean areas - add seafloor variation
    const seafloorVariation = noiseGenerators.elevation.octaveNoise(x * 0.005, y * 0.005, 3, 0.3);
    elevation = landStrength + Math.max(0, seafloorVariation * 0.05);
    elevation = Math.min(elevation, 0.49);
  }
  
  // Clamp elevation to valid range
  elevation = Math.max(0, Math.min(1, elevation));
  
  // Generate temperature based on latitude (using a reference for consistent patterns)
  const referenceHeight = 1000;
  const latitudeFactor = Math.abs((y / referenceHeight) - 0.5) * 2; // 0 at equator, 1 at poles
  let temperature = 1 - latitudeFactor; // Hot at equator, cold at poles
  temperature += noiseGenerators.temperature.octaveNoise(x * 0.008, y * 0.008, 3, 0.3) * 0.3;
  temperature -= elevation * 0.5; // Higher elevation = colder
  temperature = Math.max(0, Math.min(1, temperature));
  
  // Generate moisture patterns (same as generateMap)
  let moisture = noiseGenerators.moisture.octaveNoise(x * 0.012, y * 0.012, 4, 0.4);
  moisture = (moisture + 1) / 2; // Normalize to 0-1
  moisture = Math.max(0, Math.min(1, moisture));
  
  // Determine tile type based on specs (land or ocean)
  const tileType = getTileType(elevation);
  
  // Classify biome and elevation type
  const biome = classifyBiome(elevation, temperature, moisture);
  const elevationType = getElevationType(elevation);
  
  // Generate river information
  const river = calculateRiverType(x, y, seed);
  
  // Determine if this tile has a lake
  const lake = isLake(x, y, seed);
  
  return {
    type: tileType,
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
 * Clear all caches to prevent memory leaks
 */
export function clearGenerationCaches(): void {
  continentCache.clear();
  tileNoiseCache.clear();
  riverNoiseCache.clear();
  riverSystemCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { continents: number, tileNoise: number, riverNoise: number, riverSystems: number } {
  return {
    continents: continentCache.size,
    tileNoise: tileNoiseCache.size,
    riverNoise: riverNoiseCache.size,
    riverSystems: riverSystemCache.size
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

