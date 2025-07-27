export interface Tile {
  type: 'ocean' | 'beach' | 'desert' | 'grassland' | 'forest' | 'tundra' | 'mountain';
  x: number;
  y: number;
  elevation: number;    // 0-1, where 0 is sea level, 1 is highest peak
  temperature: number;  // 0-1, where 0 is coldest, 1 is hottest
  rainfall: number;     // 0-1, where 0 is driest, 1 is wettest
}

/**
 * Simple 2D Perlin-like noise implementation for terrain generation.
 * Creates smooth, natural-looking elevation patterns.
 */
class SimpleNoise {
  private permutation: number[];
  
  constructor(seed: number = Math.random()) {
    // Initialize permutation table with pseudo-random values based on seed
    this.permutation = [];
    const random = this.seededRandom(seed);
    
    // Create base permutation array
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    
    // Shuffle using Fisher-Yates algorithm with seeded random
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    
    // Duplicate for easier indexing
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
  }
  
  private seededRandom(seed: number) {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  /**
   * Generate noise value at given coordinates
   * @param x X coordinate (typically 0-1 range scaled by frequency)
   * @param y Y coordinate (typically 0-1 range scaled by frequency)
   * @returns Noise value between -1 and 1
   */
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
    
    return this.lerp(
      this.lerp(this.grad(this.permutation[AA], x, y), 
                this.grad(this.permutation[BA], x - 1, y), u),
      this.lerp(this.grad(this.permutation[AB], x, y - 1), 
                this.grad(this.permutation[BB], x - 1, y - 1), u), 
      v
    );
  }
  
  /**
   * Generate fractal noise by combining multiple octaves
   */
  fractalNoise(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
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
 * Calculate temperature based on latitude and elevation.
 * Higher latitudes (closer to poles) are colder, higher elevations are colder.
 */
function calculateTemperature(y: number, height: number, elevation: number): number {
  // Latitude factor: 0 at poles, 1 at equator
  const latitudeFactor = 1 - Math.abs((y / height) - 0.5) * 2;
  
  // Elevation cooling: higher elevations are colder (more pronounced effect)
  const elevationCooling = elevation * 0.4;
  
  // Base temperature from latitude, reduced by elevation
  const temperature = Math.max(0, Math.min(1, latitudeFactor - elevationCooling + 0.1));
  
  return temperature;
}

/**
 * Calculate rainfall based on latitude and random variation.
 * Higher rainfall near equator and in temperate zones.
 */
function calculateRainfall(y: number, height: number, temperature: number): number {
  // Latitude factor for rainfall (higher near equator and temperate zones)
  const latitudeNormalized = (y / height) - 0.5; // -0.5 to 0.5
  
  // Create rainfall bands: high at equator, moderate in temperate zones, low at poles and deserts
  const latitudeFactor = 1 - Math.abs(latitudeNormalized) * 1.2;
  
  // Temperature influence (warmer air holds more moisture, but not in extreme heat)
  const temperatureFactor = temperature > 0.8 ? temperature * 0.2 : temperature * 0.6;
  
  // Random variation for weather patterns
  const randomFactor = (Math.random() - 0.5) * 0.5;
  
  const rainfall = Math.max(0, Math.min(1, latitudeFactor + temperatureFactor + randomFactor));
  
  return rainfall;
}

/**
 * Determine biome based on elevation, temperature, and rainfall.
 * Simulates realistic biome distribution patterns.
 */
function assignBiome(elevation: number, temperature: number, rainfall: number): Tile['type'] {
  // Ocean: below sea level (lowered threshold for more water)
  if (elevation < 0.25) {
    return 'ocean';
  }
  
  // Beach: just above sea level
  if (elevation < 0.3) {
    return 'beach';
  }
  
  // Mountain: high elevation
  if (elevation > 0.75) {
    return 'mountain';
  }
  
  // Tundra: cold regions (more sensitive to cold)
  if (temperature < 0.35) {
    return 'tundra';
  }
  
  // Desert: hot and dry, or very dry regardless of temperature
  if ((temperature > 0.65 && rainfall < 0.4) || rainfall < 0.25) {
    return 'desert';
  }
  
  // Forest: adequate temperature and high rainfall
  if (temperature > 0.3 && rainfall > 0.55) {
    return 'forest';
  }
  
  // Grassland: default for moderate conditions
  return 'grassland';
}

/**
 * Generates a 2D map of tiles using realistic terrain generation.
 * 
 * Algorithm Overview:
 * 1. Generate elevation using fractal noise for natural landmass shapes
 * 2. Calculate temperature based on latitude (distance from equator) and elevation
 * 3. Simulate rainfall using latitude patterns and random weather variation  
 * 4. Assign biomes based on the combination of elevation, temperature, and rainfall
 * 
 * This creates maps with:
 * - Realistic continental shapes and island chains
 * - Climate zones that follow earth-like patterns (polar, temperate, tropical)
 * - Diverse biomes: ocean, beach, desert, grassland, forest, tundra, mountain
 * - Natural-looking terrain transitions
 */
export function generateMap(width: number, height: number): Tile[][] {
  const map: Tile[][] = [];
  
  // Initialize noise generator for consistent terrain
  const noise = new SimpleNoise();
  
  // Scale factors for noise sampling (larger = more zoomed out features)
  const elevationScale = 0.08; // Slightly larger continents
  
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      // Generate elevation using fractal noise for natural landmass shapes
      let elevation = noise.fractalNoise(x * elevationScale, y * elevationScale, 4, 0.5);
      // Normalize to 0-1 range and add slight bias toward lower elevations
      elevation = (elevation + 1) / 2;
      elevation = Math.pow(elevation, 1.2); // Bias toward lower values
      
      // Calculate temperature based on latitude and elevation
      const temperature = calculateTemperature(y, height, elevation);
      
      // Calculate rainfall based on latitude and temperature
      const rainfall = calculateRainfall(y, height, temperature);
      
      // Determine biome based on environmental factors
      const biome = assignBiome(elevation, temperature, rainfall);
      
      row.push({
        type: biome,
        x,
        y,
        elevation: Math.max(0, Math.min(1, elevation)),
        temperature: Math.max(0, Math.min(1, temperature)),
        rainfall: Math.max(0, Math.min(1, rainfall))
      });
    }
    map.push(row);
  }
  
  return map;
}