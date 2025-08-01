# The generator
- The world generator should be inspired by that of dwarf fortress and minecraft, but it should not use any copyrighted material.
- Maps should always be square.
- Maps should be realistic, the algorithm complete and extensive.
- 3rd party libraries may be used for better implementation.
- The generator should support generating the map in 1 call, as well as in batched chunks to optimize rendering in the frontend.
- given a seed, the generator should always output the same

# Continents
- The world generator should generate world maps containing 1, 2 or 3 continents.
- Each continent is separated by ocean. 
- The distance between continents should be at least 5% of the total map width.
- In total between 25% and 35% of the total map should be ocean. The rest land.
- Continents use noise-based generation for natural, irregular coastlines instead of circular shapes.

## Continent Generation Algorithm
- Uses multi-octave Perlin noise with domain warping for natural landmass shapes
- Large-scale continent shape: Low frequency (0.003), high amplitude (0.6), 3 octaves
- Medium-scale features: Moderate frequency (0.008), moderate amplitude (0.5), 4 octaves  
- Fine-scale coastal details: High frequency (0.02), low amplitude (0.4), 3 octaves
- Domain warping: 15-pixel strength with 3 octaves at 0.008 frequency for irregular coastlines
- Post-processing ensures consistent ocean coverage within target range (25-35%)

# Tiles types
- The possible tile types are land and ocean.

# Vegetation Density
- Each tile has a vegetation density property that indicates the density of plant life
- Vegetation density has three possible values:
  - **low**: Sparse vegetation (deserts, arctic regions, alpine areas, ocean with minimal marine plants)
  - **med**: Moderate vegetation (grasslands, savannas)  
  - **high**: Dense vegetation (forests, jungles, swamps, taiga)
- Vegetation density is calculated based on:
  - **Biome type**: Different biomes have characteristic vegetation patterns
  - **Temperature**: Warmer areas generally support more vegetation
  - **Moisture**: Higher moisture supports denser vegetation
  - **Elevation**: Very high elevations reduce vegetation density even in forest biomes
- Ocean biomes always have low vegetation density (representing marine algae and plants)
- The algorithm ensures logical consistency between biome classification and vegetation density

## Vegetation Density Algorithm
- **Ocean biomes** (deep_ocean, shallow_ocean): Always **low**
- **Sparse biomes** (desert, arctic, tundra, alpine): Always **low**
- **Moderate biomes** (grassland, savanna): **med** by default, **high** if moisture > 0.7 and temperature > 0.4
- **Dense biomes** (forest, taiga, tropical_forest, swamp): **high** by default, **med** if elevation > 0.8
- **Fallback logic**: Based on climate conditions - too cold/dry gets **low**, warm and wet gets **high**, moderate conditions get **med**

# Rivers
- Rivers are generated on land tiles to create realistic waterways that follow natural terrain features
- Each tile can contain a river segment with the following types:
  - none: No river segment
  - horizontal: Horizontal river flow (west-east)
  - vertical: Vertical river flow (north-south)  
  - bend_ne, bend_nw, bend_se, bend_sw: Bends from cardinal directions
  - bend_en, bend_es, bend_wn, bend_ws: Bends to cardinal directions
- Rivers follow elevation gradients, flowing from high to low elevation areas with natural meandering
- River sources are placed at higher elevation areas with adequate moisture using deterministic noise
- Flow accumulation simulates realistic drainage patterns using multi-layered noise (primary drainage and watershed patterns)
- River generation uses 8-directional flow calculation for more natural paths than simple 4-directional
- Rivers integrate smoothly with terrain features and biomes, appearing as blue overlays in visualization
- River density targets 5-15% of land tiles for realistic appearance
- River generation is deterministic based on seed and coordinates, optimized with cached noise generators
- Rivers terminate naturally at ocean boundaries and map edges

# Performance Characteristics
- The generator is optimized for large map generation with caching systems to avoid redundant calculations
- Target performance: 60×60 chunks (921,600 tiles) should generate in under 30 seconds
- Single chunk generation should complete in under 50ms for good user experience
- Uses cached continent data and noise generators to achieve 600x+ performance improvement over naive implementation
- Memory-efficient caching prevents excessive memory usage during large map generation
- Maintains deterministic generation while achieving high performance through stateless chunk generation
