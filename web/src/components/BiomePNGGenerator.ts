/**
 * Pre-generated biome PNG system for optimal performance and browser caching
 * Instead of generating PNGs on the fly, we create reusable PNG images for each biome type
 */

type BiomeKey = 'deep_ocean' | 'shallow_ocean' | 'desert' | 'tundra' | 'arctic' | 'swamp' | 
               'grassland' | 'forest' | 'taiga' | 'savanna' | 'tropical_forest' | 'alpine'

const BIOME_COLORS: Record<BiomeKey, [number, number, number]> = {
  deep_ocean: [65, 105, 225],       // Royal blue
  shallow_ocean: [100, 150, 230],   // Medium blue
  desert: [238, 203, 173],          // Sandy beige
  tundra: [176, 196, 222],          // Light steel blue
  arctic: [248, 248, 255],          // Ghost white
  swamp: [85, 107, 47],             // Dark olive green
  grassland: [124, 252, 0],         // Lawn green
  forest: [34, 139, 34],            // Forest green
  taiga: [60, 100, 60],             // Dark green
  savanna: [189, 183, 107],         // Dark khaki
  tropical_forest: [0, 100, 0],     // Dark green
  alpine: [169, 169, 169]           // Dark gray
}

// Cache for generated biome PNGs
const biomePNGCache = new Map<string, string>()

/**
 * Generate a single tile PNG for a biome with optional elevation shading
 */
function generateBiomeTilePNG(biome: BiomeKey, elevation: number = 0.5, tileSize: number = 6): string {
  const cacheKey = `${biome}-${Math.round(elevation * 10)}-${tileSize}`
  
  if (biomePNGCache.has(cacheKey)) {
    return biomePNGCache.get(cacheKey)!
  }
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Unable to create canvas context')
  }
  
  canvas.width = tileSize
  canvas.height = tileSize
  
  // Get base color and apply elevation shading
  const baseColor = BIOME_COLORS[biome] || [128, 128, 128]
  const darkeningFactor = 1 - (elevation * 0.4) // Reduce up to 40% brightness at max elevation
  const shadedColor = [
    Math.floor(baseColor[0] * darkeningFactor),
    Math.floor(baseColor[1] * darkeningFactor),
    Math.floor(baseColor[2] * darkeningFactor)
  ]
  
  // Fill the entire tile with the biome color
  ctx.fillStyle = `rgb(${shadedColor[0]}, ${shadedColor[1]}, ${shadedColor[2]})`
  ctx.fillRect(0, 0, tileSize, tileSize)
  
  const dataUrl = canvas.toDataURL('image/png')
  biomePNGCache.set(cacheKey, dataUrl)
  
  return dataUrl
}

/**
 * Pre-generate all biome PNGs with different elevation levels for caching
 */
export function preGenerateBiomePNGs(tileSize: number = 6): Map<string, string> {
  const biomes: BiomeKey[] = [
    'deep_ocean', 'shallow_ocean', 'desert', 'tundra', 'arctic', 'swamp',
    'grassland', 'forest', 'taiga', 'savanna', 'tropical_forest', 'alpine'
  ]
  
  const results = new Map<string, string>()
  
  // Generate PNGs for each biome with different elevation levels (0.0 to 1.0 in 0.1 steps)
  for (const biome of biomes) {
    for (let elevationLevel = 0; elevationLevel <= 10; elevationLevel++) {
      const elevation = elevationLevel / 10
      const cacheKey = `${biome}-${elevationLevel}-${tileSize}`
      const dataUrl = generateBiomeTilePNG(biome, elevation, tileSize)
      results.set(cacheKey, dataUrl)
    }
  }
  
  console.log(`Pre-generated ${results.size} biome PNGs for browser caching`)
  return results
}

/**
 * Get a cached biome PNG for a specific biome and elevation
 */
export function getBiomePNG(biome: string, elevation: number, tileSize: number = 6): string {
  const elevationLevel = Math.round(elevation * 10)
  const cacheKey = `${biome}-${elevationLevel}-${tileSize}`
  
  if (biomePNGCache.has(cacheKey)) {
    return biomePNGCache.get(cacheKey)!
  }
  
  // Generate on demand if not found
  return generateBiomeTilePNG(biome as BiomeKey, elevation, tileSize)
}

/**
 * Clear the biome PNG cache
 */
export function clearBiomePNGCache(): void {
  biomePNGCache.clear()
}