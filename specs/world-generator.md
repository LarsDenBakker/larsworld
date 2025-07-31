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

# Rivers
- Rivers are generated on land tiles to create realistic waterways
- Each tile can contain a river segment with the following types:
  - none: No river segment
  - horizontal: Horizontal river flow (west-east)
  - vertical: Vertical river flow (north-south)  
  - bend_ne, bend_nw, bend_se, bend_sw: Bends from cardinal directions
  - bend_en, bend_es, bend_wn, bend_ws: Bends to cardinal directions
- Rivers follow elevation gradients, flowing from high to low elevation areas
- River sources are placed at higher elevation areas using deterministic noise
- River generation is deterministic based on seed and coordinates
- Rivers are visualized as blue overlays on the terrain in PNG output

# Performance Characteristics
- The generator is optimized for large map generation with caching systems to avoid redundant calculations
- Target performance: 60×60 chunks (921,600 tiles) should generate in under 30 seconds
- Single chunk generation should complete in under 50ms for good user experience
- Uses cached continent data and noise generators to achieve 600x+ performance improvement over naive implementation
- Memory-efficient caching prevents excessive memory usage during large map generation
- Maintains deterministic generation while achieving high performance through stateless chunk generation
