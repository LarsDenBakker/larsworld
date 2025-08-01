/**
 * Static biome PNG system using pre-generated static files
 * Replaces client-side PNG generation with static file fetching for optimal performance
 */

type BiomeKey = 'deep_ocean' | 'shallow_ocean' | 'desert' | 'tundra' | 'arctic' | 'swamp' | 
               'grassland' | 'forest' | 'taiga' | 'savanna' | 'tropical_forest' | 'alpine'

// Cache for static biome PNG URLs
const staticBiomePNGCache = new Map<string, string>()

/**
 * Get the URL for a static biome PNG file
 */
export function getStaticBiomePNGUrl(biome: string, elevation: number): string {
  const elevationLevel = Math.round(elevation * 10)
  return `/biomes/${biome}-${elevationLevel}.png`
}

/**
 * Get the URL for a base biome PNG (for CSS gradient approach)
 */
export function getBaseBiomePNGUrl(biome: string): string {
  return `/biomes/base/${biome}.png`
}

/**
 * Pre-load all biome PNGs into browser cache for optimal performance
 * This function loads static PNG files instead of generating them
 */
export async function preLoadStaticBiomePNGs(): Promise<Map<string, string>> {
  const biomes: BiomeKey[] = [
    'deep_ocean', 'shallow_ocean', 'desert', 'tundra', 'arctic', 'swamp',
    'grassland', 'forest', 'taiga', 'savanna', 'tropical_forest', 'alpine'
  ]
  
  const results = new Map<string, string>()
  const loadPromises: Promise<void>[] = []
  
  console.log('🎨 Pre-loading static biome PNGs...')
  
  // Pre-load all elevation-specific PNGs
  for (const biome of biomes) {
    for (let elevationLevel = 0; elevationLevel <= 10; elevationLevel++) {
      const elevation = elevationLevel / 10
      const cacheKey = `${biome}-${elevationLevel}`
      const url = getStaticBiomePNGUrl(biome, elevation)
      
      // Create a promise to load each image
      const loadPromise = new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          staticBiomePNGCache.set(cacheKey, url)
          results.set(cacheKey, url)
          resolve()
        }
        img.onerror = () => {
          console.warn(`Failed to load biome PNG: ${url}`)
          reject(new Error(`Failed to load ${url}`))
        }
        img.src = url
      })
      
      loadPromises.push(loadPromise)
    }
  }
  
  // Wait for all images to load
  try {
    await Promise.all(loadPromises)
    console.log(`✅ Pre-loaded ${results.size} static biome PNGs into browser cache`)
  } catch (error) {
    console.error('❌ Some biome PNGs failed to load:', error)
  }
  
  return results
}

/**
 * Get a static biome PNG URL for a specific biome and elevation
 * Returns cached URL if available, otherwise generates the URL
 */
export function getStaticBiomePNG(biome: string, elevation: number): string {
  const elevationLevel = Math.round(elevation * 10)
  const cacheKey = `${biome}-${elevationLevel}`
  
  if (staticBiomePNGCache.has(cacheKey)) {
    return staticBiomePNGCache.get(cacheKey)!
  }
  
  // Generate URL even if not pre-loaded (browser will fetch as needed)
  const url = getStaticBiomePNGUrl(biome, elevation)
  staticBiomePNGCache.set(cacheKey, url)
  return url
}

/**
 * CSS gradient-based elevation approach
 * Uses base biome PNG with CSS filter/gradient overlay for elevation effects
 */
export function createElevationCSS(elevation: number): string {
  // Create a CSS filter that darkens the image based on elevation
  // Higher elevation = darker (simulating shadow/height effect)
  const darkenAmount = elevation * 0.4 // Up to 40% darkening at max elevation
  const brightness = 1 - darkenAmount
  
  return `filter: brightness(${brightness});`
}

/**
 * Alternative: CSS gradient overlay approach
 */
export function createElevationOverlay(elevation: number): string {
  // Create a semi-transparent black overlay for elevation effect
  const overlayOpacity = elevation * 0.4 // Up to 40% opacity at max elevation
  
  return `
    position: relative;
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, ${overlayOpacity});
      pointer-events: none;
    }
  `
}

/**
 * Clear the static biome PNG cache
 */
export function clearStaticBiomePNGCache(): void {
  staticBiomePNGCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: staticBiomePNGCache.size,
    keys: Array.from(staticBiomePNGCache.keys())
  }
}