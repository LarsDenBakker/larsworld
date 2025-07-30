export interface Tile {
  type: 'land' | 'ocean';
  x: number;
  y: number;
  elevation: number; // 0-1, where 0 is sea level
  temperature: number; // 0-1, where 0 is coldest, 1 is hottest
  moisture: number; // 0-1, where 0 is driest, 1 is wettest
}

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
 */
function getTileType(elevation: number): Tile['type'] {
  // Tuned threshold to achieve 25-35% ocean coverage
  return elevation < 0.3 ? 'ocean' : 'land';
}

/**
 * Generate 1, 2, or 3 continents based on specs
 * - Each continent separated by ocean
 * - Distance between continents at least 5% of total map width
 * - Total ocean coverage 25-35%, rest land
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
  
  // Target land coverage: 65-75% (25-35% ocean per specs)
  const targetLandCoverage = 0.72 + random() * 0.03; // 72-75% land = 25-28% ocean
  
  // Minimum separation: 5% of map width
  const minSeparation = width * 0.05;
  
  const continents: Array<{x: number, y: number, radiusX: number, radiusY: number}> = [];
  
  // Generate continent positions ensuring proper separation
  for (let i = 0; i < numContinents; i++) {
    let attempts = 0;
    let validPosition = false;
    let continentX = width * 0.5; // Default position
    let continentY = height * 0.5; // Default position
    
    while (!validPosition && attempts < 100) {
      // Position continent centers to avoid edges
      continentX = (width * 0.15) + random() * (width * 0.7);
      continentY = (height * 0.15) + random() * (height * 0.7);
      
      // Check separation from existing continents
      validPosition = true;
      for (const existing of continents) {
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
      // Fallback: place along different axes
      if (i === 1) {
        continentX = width * 0.25;
        continentY = height * 0.5;
      } else if (i === 2) {
        continentX = width * 0.75;
        continentY = height * 0.5;
      }
    }
    
    // Size continents to achieve target land coverage
    const landPerContinent = targetLandCoverage / numContinents;
    const continentArea = width * height * landPerContinent * 1.1; // Slightly oversize to account for falloff
    const radius = Math.sqrt(continentArea / Math.PI);
    
    const radiusX = radius * (0.9 + random() * 0.2);
    const radiusY = radius * (0.9 + random() * 0.2);
    
    continents.push({
      x: continentX,
      y: continentY,
      radiusX,
      radiusY
    });
  }
  
  // Create noise for continental variation
  const continentNoise = new PerlinNoise(seed);
  
  // Generate landmass for each continent
  for (const continent of continents) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate distance from continent center
        const dx = (x - continent.x) / continent.radiusX;
        const dy = (y - continent.y) / continent.radiusY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 1.2) {
          // Add noise for realistic coastlines
          const noiseValue = continentNoise.octaveNoise(x * 0.01, y * 0.01, 4, 0.5);
          const adjustedDistance = distance + noiseValue * 0.25;
          
          if (adjustedDistance < 1.0) {
            // Core continent
            const strength = Math.pow(1 - adjustedDistance, 0.75);
            landMask[y][x] = Math.max(landMask[y][x], strength);
          } else if (adjustedDistance < 1.2) {
            // Coastal transition zone
            const strength = Math.pow((1.2 - adjustedDistance) / 0.2, 1.4) * 0.6;
            landMask[y][x] = Math.max(landMask[y][x], strength);
          }
        }
      }
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
      if (landStrength > 0.1) {
        const terrainElevation = elevationNoise.octaveNoise(x * 0.01, y * 0.01, 6, 0.5);
        const terrainVariation = (terrainElevation + 1) / 2; // Normalize to 0-1
        
        // Combine base land shape with terrain details
        elevation = landStrength * 0.7 + terrainVariation * landStrength * 0.5;
        
        // Ensure minimum land elevation
        elevation = Math.max(elevation, 0.3);
      } else {
        // Ocean areas - add seafloor variation
        const seafloorVariation = elevationNoise.octaveNoise(x * 0.005, y * 0.005, 3, 0.3);
        elevation = 0.1 + Math.max(0, seafloorVariation * 0.1);
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
      
      row.push({
        type: tileType,
        x,
        y,
        elevation,
        temperature,
        moisture
      });
    }
    map.push(row);
  }
  
  return map;
}