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
 * Generate a continent shape using distance fields and noise distortion
 * Creates realistic continental formations inspired by natural geography
 */
function generateContinent(width: number, height: number, noise: PerlinNoise): number[][] {
  const continent: number[][] = [];
  
  // Position the continent slightly off-center for more natural look
  // This simulates viewing a portion of a larger world, not the entire globe
  const centerX = width * (0.4 + 0.2 * Math.random()); // 40-60% across
  const centerY = height * (0.45 + 0.1 * Math.random()); // 45-55% down
  
  // Continent should cover a significant portion but ensure 20-40% ocean coverage
  // For smaller maps, use more conservative continent sizing to ensure ocean coverage
  const isSmallMap = width < 100 || height < 100;
  const oceanTargetFactor = isSmallMap ? 0.85 : 0.9; // More conservative for small maps
  
  const continentRadiusX = width * (0.25 + 0.05 * Math.random()) * oceanTargetFactor;
  const continentRadiusY = height * (0.22 + 0.04 * Math.random()) * oceanTargetFactor;
  
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      // Calculate normalized distance from continent center
      const dx = (x - centerX) / continentRadiusX;
      const dy = (y - centerY) / continentRadiusY;
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
      
      // Apply layered noise distortion for realistic coastlines
      // Large-scale coastal features (bays, peninsulas)
      const largeCoastalNoise = noise.octaveNoise(x * 0.008, y * 0.008, 3, 0.7);
      // Medium-scale coastal complexity
      const mediumCoastalNoise = noise.octaveNoise(x * 0.015, y * 0.015, 4, 0.5);
      // Fine-scale coastal detail
      const fineCoastalNoise = noise.octaveNoise(x * 0.03, y * 0.03, 3, 0.3);
      
      // Combine noise layers for multi-scale coastline realism
      const noiseFactor = largeCoastalNoise * 0.25 + mediumCoastalNoise * 0.15 + fineCoastalNoise * 0.1;
      const adjustedDistance = distanceFromCenter + noiseFactor;
      
      // Create continent shape with smooth falloff
      let continentStrength = 0;
      if (adjustedDistance < 1.2) { // Slightly larger threshold for more land
        if (adjustedDistance < 1.0) {
          // Core continent area - strong land presence
          continentStrength = Math.pow(1 - adjustedDistance, 0.7);
        } else {
          // Transition zone - creates peninsulas and coastal complexity
          const transitionFactor = 1.2 - adjustedDistance;
          continentStrength = Math.pow(transitionFactor / 0.2, 1.5) * 0.6;
        }
      }
      
      row.push(continentStrength);
    }
    continent.push(row);
  }
  
  return continent;
}

/**
 * Generate islands scattered around the continent
 * Creates archipelagos and island chains for variety and realism
 */
function generateIslands(width: number, height: number, continent: number[][], noise: PerlinNoise): number[][] {
  const islands: number[][] = [];
  
  // Initialize with zeros
  for (let y = 0; y < height; y++) {
    islands.push(new Array(width).fill(0));
  }
  
  // Generate several island clusters/archipelagos
  const numIslandClusters = 4 + Math.floor(Math.random() * 3); // 4-6 clusters
  
  for (let cluster = 0; cluster < numIslandClusters; cluster++) {
    // Find good location for islands - prefer areas with some distance from continent
    let islandX, islandY, attempts = 0;
    let bestScore = -1;
    let bestX = 0, bestY = 0;
    
    // Try multiple locations and pick the best one
    while (attempts < 30) {
      const candidateX = Math.random() * width;
      const candidateY = Math.random() * height;
      const continentStrength = continent[Math.floor(candidateY)][Math.floor(candidateX)];
      
      // Prefer locations with moderate distance from continent (not too close, not too far)
      let score = 0;
      if (continentStrength < 0.1) {
        // Good - in ocean but not too far from continent
        score = 0.8;
        
        // Bonus for being near (but not on) continent edges
        const nearbyLand = checkNearbyLand(continent, candidateX, candidateY, 80);
        if (nearbyLand > 0 && nearbyLand < 0.3) {
          score += 0.5; // Islands near continental shelves
        }
      } else if (continentStrength < 0.3) {
        // Acceptable - coastal waters
        score = 0.4;
      }
      
      // Avoid map edges
      const edgeDistance = Math.min(candidateX, candidateY, width - candidateX, height - candidateY);
      if (edgeDistance < 50) {
        score *= 0.3;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestX = candidateX;
        bestY = candidateY;
      }
      
      attempts++;
    }
    
    islandX = bestX;
    islandY = bestY;
    
    // Create island cluster/archipelago
    const clusterRadius = 60 + Math.random() * 80; // Variable cluster size
    const numIslands = 2 + Math.floor(Math.random() * 4); // 2-5 islands per cluster
    
    for (let island = 0; island < numIslands; island++) {
      // Position island within cluster - sometimes create island chains
      let ix, iy;
      if (island === 0) {
        // First island at cluster center
        ix = islandX;
        iy = islandY;
      } else {
        // Subsequent islands can form chains or be scattered
        if (Math.random() < 0.6) {
          // Chain formation - extend from previous islands
          const chainAngle = Math.random() * Math.PI * 2;
          const chainDistance = 30 + Math.random() * 50;
          ix = islandX + Math.cos(chainAngle) * chainDistance * island * 0.7;
          iy = islandY + Math.sin(chainAngle) * chainDistance * island * 0.7;
        } else {
          // Scattered formation
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * clusterRadius;
          ix = islandX + Math.cos(angle) * distance;
          iy = islandY + Math.sin(angle) * distance;
        }
      }
      
      // Skip if island would be outside map or on existing land
      if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue;
      if (continent[Math.floor(iy)][Math.floor(ix)] > 0.4) continue;
      
      // Island size varies based on position in cluster
      const baseRadius = island === 0 ? 25 + Math.random() * 25 : 15 + Math.random() * 20;
      const islandRadius = baseRadius;
      
      // Generate island shape with realistic coastlines
      for (let y = Math.max(0, Math.floor(iy - islandRadius)); y < Math.min(height, Math.ceil(iy + islandRadius)); y++) {
        for (let x = Math.max(0, Math.floor(ix - islandRadius)); x < Math.min(width, Math.ceil(ix + islandRadius)); x++) {
          const dx = x - ix;
          const dy = y - iy;
          const distanceFromIslandCenter = Math.sqrt(dx * dx + dy * dy);
          
          if (distanceFromIslandCenter < islandRadius) {
            // Apply noise for irregular island shape
            const islandShapeNoise = noise.octaveNoise(x * 0.04, y * 0.04, 3, 0.6);
            const islandDetailNoise = noise.octaveNoise(x * 0.08, y * 0.08, 2, 0.3);
            const totalNoise = islandShapeNoise * 8 + islandDetailNoise * 4;
            
            const adjustedDistance = distanceFromIslandCenter + totalNoise;
            
            if (adjustedDistance < islandRadius) {
              const islandStrength = Math.pow(1 - adjustedDistance / islandRadius, 1.1);
              // Islands are generally lower elevation than main continent
              const maxStrength = 0.7 + Math.random() * 0.2;
              islands[y][x] = Math.max(islands[y][x], islandStrength * maxStrength);
            }
          }
        }
      }
    }
  }
  
  return islands;
}

/**
 * Check for nearby land within a given radius
 */
function checkNearbyLand(continent: number[][], x: number, y: number, radius: number): number {
  let landSum = 0;
  let count = 0;
  const intX = Math.floor(x);
  const intY = Math.floor(y);
  
  for (let dy = -radius; dy <= radius; dy += 10) {
    for (let dx = -radius; dx <= radius; dx += 10) {
      const checkX = intX + dx;
      const checkY = intY + dy;
      
      if (checkX >= 0 && checkX < continent[0].length && checkY >= 0 && checkY < continent.length) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          landSum += continent[checkY][checkX];
          count++;
        }
      }
    }
  }
  
  return count > 0 ? landSum / count : 0;
}

/**
 * Generates a realistic 2D map featuring one large continent with scattered islands
 * Ocean coverage is approximately 20-40% of the map
 */
export function generateMap(width: number, height: number): Tile[][] {
  const map: Tile[][] = [];
  
  // Initialize noise generators with different seeds for variety
  const continentNoise = new PerlinNoise(Math.random());
  const islandNoise = new PerlinNoise(Math.random());
  const elevationNoise = new PerlinNoise(Math.random());
  const temperatureNoise = new PerlinNoise(Math.random());
  const moistureNoise = new PerlinNoise(Math.random());
  
  // Generate the main continent
  const continent = generateContinent(width, height, continentNoise);
  
  // Generate islands around the continent
  const islands = generateIslands(width, height, continent, islandNoise);
  
  // Force ocean boundaries on all edges for map consistency
  const oceanBorderWidth = Math.min(Math.max(3, Math.min(width, height) * 0.05), 8);
  
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      // Calculate distance from nearest edge
      const distanceFromEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
      
      // Combine continent and island contributions
      const landStrength = Math.max(continent[y][x], islands[y][x]);
      
      // Base elevation from land strength
      let elevation = landStrength;
      
      // Add detailed terrain elevation using noise
      if (landStrength > 0.1) {
        // Land areas - add terrain variation
        const terrainElevation = elevationNoise.octaveNoise(x * 0.01, y * 0.01, 6, 0.5);
        const terrainVariation = (terrainElevation + 1) / 2; // Normalize to 0-1
        
        // Combine base land shape with terrain details
        elevation = landStrength * 0.7 + terrainVariation * landStrength * 0.5;
        
        // Add mountain ranges in the interior of large landmasses
        if (landStrength > 0.6) {
          const ridgeNoise = Math.abs(elevationNoise.octaveNoise(x * 0.02, y * 0.02, 4, 0.4));
          elevation += ridgeNoise * landStrength * 0.4;
        }
        
        // Ensure minimum land elevation
        elevation = Math.max(elevation, 0.25 + landStrength * 0.1);
      } else {
        // Ocean areas - add seafloor variation
        const seafloorVariation = elevationNoise.octaveNoise(x * 0.005, y * 0.005, 3, 0.3);
        elevation = 0.1 + Math.max(0, seafloorVariation * 0.1);
      }
      
      // Force ocean boundaries for map edges
      if (distanceFromEdge < oceanBorderWidth) {
        const edgeFactor = distanceFromEdge / oceanBorderWidth;
        const forcedOceanElevation = 0.05;
        elevation = Math.min(elevation, forcedOceanElevation + elevation * edgeFactor * 0.3);
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
      
      // Add coastal moisture effects
      if (landStrength > 0.1 && landStrength < 0.7) {
        moisture += 0.2; // Coastal areas are more humid
      }
      
      moisture = Math.max(0, Math.min(1, moisture));
      
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