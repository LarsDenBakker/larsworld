export interface Tile {
  type: 'water' | 'sand' | 'grass' | 'forest' | 'mountain';
  x: number;
  y: number;
}

/**
 * Generates a 2D map of tiles using basic randomization.
 * Future improvements could include biome clustering, elevation-based generation, etc.
 */
export function generateMap(width: number, height: number): Tile[][] {
  const map: Tile[][] = [];
  
  // Define terrain type probabilities for basic random generation
  const terrainTypes: Tile['type'][] = ['water', 'sand', 'grass', 'forest', 'mountain'];
  const terrainWeights = [0.15, 0.1, 0.4, 0.25, 0.1]; // Grass is most common, water and mountains least
  
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const randomValue = Math.random();
      let cumulativeWeight = 0;
      let selectedType: Tile['type'] = 'grass'; // Default fallback
      
      // Select terrain type based on weighted random selection
      for (let i = 0; i < terrainTypes.length; i++) {
        cumulativeWeight += terrainWeights[i];
        if (randomValue <= cumulativeWeight) {
          selectedType = terrainTypes[i];
          break;
        }
      }
      
      row.push({
        type: selectedType,
        x,
        y
      });
    }
    map.push(row);
  }
  
  return map;
}