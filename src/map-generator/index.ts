export interface Tile {
  type: 'ocean' | 'shallow_water' | 'beach' | 'desert' | 'grassland' | 'forest' | 'tundra' | 'mountain' | 'snow' | 'swamp';
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
 * Determines biome based on temperature, moisture, and elevation
 */
function getBiome(temperature: number, moisture: number, elevation: number): Tile['type'] {
  // Ocean and shallow water based on elevation - adjusted for better ocean coverage
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
 * Generates a realistic 2D map using noise-based elevation and climate simulation
 * For 500x500+ maps, creates earthlike planet with realistic continental shapes
 */
export function generateMap(width: number, height: number): Tile[][] {
  const map: Tile[][] = [];
  
  // Initialize noise generators with different seeds for variety
  const elevationNoise = new PerlinNoise(Math.random());
  const continentalNoise = new PerlinNoise(Math.random());
  const coastalNoise = new PerlinNoise(Math.random());
  const temperatureNoise = new PerlinNoise(Math.random());
  const moistureNoise = new PerlinNoise(Math.random());
  
  // For large maps (500x500+), use earthlike continent generation
  const isLargeMap = width >= 500 && height >= 500;
  
  // Scale factors for noise sampling - adjusted for realistic continental features
  const continentalScale = isLargeMap ? 0.002 : 0.01; // Very large continental patterns
  const elevationScale = isLargeMap ? 0.008 : 0.05; // Regional terrain features
  const coastalScale = isLargeMap ? 0.02 : 0.1; // Coastal complexity
  const temperatureScale = isLargeMap ? 0.004 : 0.02; // Large climate zones
  const moistureScale = isLargeMap ? 0.015 : 0.08; // Medium-sized moisture patterns
  
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      let elevation = 0;
      
      if (isLargeMap) {
        // Create realistic continental patterns using layered noise
        
        // Large-scale continental structure (major landmass placement)
        const continentalPattern = continentalNoise.octaveNoise(x * continentalScale, y * continentalScale, 4, 0.6);
        
        // Regional elevation variations
        const regionalElevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 6, 0.5);
        
        // Coastal complexity and irregular shapes
        const coastalComplexity = coastalNoise.octaveNoise(x * coastalScale, y * coastalScale, 4, 0.4);
        
        // Combine noise layers for realistic terrain
        // Continental pattern provides the main land/ocean distribution
        let baseLand = continentalPattern * 0.7 + regionalElevation * 0.3;
        
        // Add coastal irregularity for realistic coastline shapes
        baseLand += coastalComplexity * 0.15;
        
        // Normalize and adjust for earthlike land/ocean ratio (approximately 30% land)
        elevation = (baseLand + 1) / 2; // Normalize to 0-1
        
        // Create more realistic elevation distribution
        // Bias toward ocean (sea level) but allow for significant landmasses
        elevation = Math.pow(elevation, 1.2); // Slightly favor lower elevations for more ocean
        
        // Enhance continental structure by strengthening land areas
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
      
      row.push({
        type: biome,
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

export interface MapChunk {
  startY: number;
  endY: number;
  chunkIndex: number;
  totalChunks: number;
  rows: Tile[][];
}

/**
 * Generates a map in chunks to avoid timeouts and enable streaming
 */
export function generateMapChunked(
  width: number, 
  height: number, 
  onChunk: (chunk: MapChunk) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): void {
  try {
    const chunkSize = 50; // Generate 50 rows at a time
    const totalChunks = Math.ceil(height / chunkSize);
    let currentChunk = 0;
    
    // Initialize noise generators with consistent seeds for coherent terrain
    const seed = Math.random();
    const elevationNoise = new PerlinNoise(seed);
    const continentalNoise = new PerlinNoise(seed + 0.1);
    const coastalNoise = new PerlinNoise(seed + 0.2);
    const temperatureNoise = new PerlinNoise(seed + 0.3);
    const moistureNoise = new PerlinNoise(seed + 0.4);
    
    // For large maps (500x500+), use earthlike continent generation
    const isLargeMap = width >= 500 && height >= 500;
    
    // Scale factors for noise sampling - adjusted for realistic continental features
    const continentalScale = isLargeMap ? 0.002 : 0.01;
    const elevationScale = isLargeMap ? 0.008 : 0.05;
    const coastalScale = isLargeMap ? 0.02 : 0.1;
    const temperatureScale = isLargeMap ? 0.004 : 0.02;
    const moistureScale = isLargeMap ? 0.015 : 0.08;
    
    function generateNextChunk() {
      try {
        const startY = currentChunk * chunkSize;
        const endY = Math.min(startY + chunkSize, height);
        const rows: Tile[][] = [];
        
        for (let y = startY; y < endY; y++) {
          const row: Tile[] = [];
          for (let x = 0; x < width; x++) {
            let elevation = 0;
            
            if (isLargeMap) {
              // Create realistic continental patterns using layered noise
              const continentalPattern = continentalNoise.octaveNoise(x * continentalScale, y * continentalScale, 4, 0.6);
              const regionalElevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 6, 0.5);
              const coastalComplexity = coastalNoise.octaveNoise(x * coastalScale, y * coastalScale, 4, 0.4);
              
              let baseLand = continentalPattern * 0.7 + regionalElevation * 0.3;
              baseLand += coastalComplexity * 0.15;
              
              elevation = (baseLand + 1) / 2;
              elevation = Math.pow(elevation, 1.2);
              
              if (elevation > 0.35) {
                elevation = 0.35 + (elevation - 0.35) * 1.4;
                const ridgeNoise = Math.abs(elevationNoise.octaveNoise(x * elevationScale * 2, y * elevationScale * 2, 3, 0.5));
                if (elevation > 0.6) {
                  elevation += ridgeNoise * 0.3;
                }
              } else {
                elevation = elevation * 0.8;
              }
            } else {
              elevation = elevationNoise.octaveNoise(x * elevationScale, y * elevationScale, 5, 0.5);
              elevation = (elevation + 1) / 2;
              elevation = Math.pow(elevation, 0.8);
              if (elevation < 0.4) {
                elevation = elevation * 0.7;
              }
            }
            
            // Generate temperature based on latitude and elevation
            const latitudeFactor = Math.abs((y / height) - 0.5) * 2;
            let temperature = 1 - latitudeFactor;
            temperature += temperatureNoise.octaveNoise(x * temperatureScale, y * temperatureScale, 2, 0.3) * 0.3;
            temperature -= elevation * 0.4;
            temperature = Math.max(0, Math.min(1, temperature));
            
            // Generate moisture patterns
            let moisture = moistureNoise.octaveNoise(x * moistureScale, y * moistureScale, 3, 0.4);
            moisture = (moisture + 1) / 2;
            moisture = Math.max(0, Math.min(1, moisture));
            
            // Determine biome
            const biome = getBiome(temperature, moisture, elevation);
            
            row.push({
              type: biome,
              x,
              y,
              elevation,
              temperature,
              moisture
            });
          }
          rows.push(row);
        }
        
        // Send chunk
        const chunk: MapChunk = {
          startY,
          endY,
          chunkIndex: currentChunk,
          totalChunks,
          rows
        };
        
        onChunk(chunk);
        currentChunk++;
        
        // Schedule next chunk or complete
        if (currentChunk < totalChunks) {
          // Use setTimeout to avoid blocking and allow for proper streaming
          setTimeout(generateNextChunk, 10);
        } else {
          onComplete();
        }
      } catch (error) {
        onError(error as Error);
      }
    }
    
    // Start generation
    generateNextChunk();
    
  } catch (error) {
    onError(error as Error);
  }
}