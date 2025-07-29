# Dwarf Fortress-Style World Generation

This document describes the enhanced world generation features that implement Dwarf Fortress-style continental patterns with strict ocean boundaries.

## Features

### Ocean Boundary Enforcement
- **5% Boundary Requirement**: All map edges have ocean for at least 5% of the map dimensions (50 pixels on 1000x1000 maps)
- **Hard Boundaries**: Elevation is forced to very low values near edges to guarantee ocean biomes
- **Toroidal Wrap Support**: Left/right edges are guaranteed ocean for proper wrapping logic

### Continental Generation
- **Separate Continents**: Uses dual continental noise patterns to create distinct landmasses
- **Ocean Separation**: Continents are naturally separated by ocean areas
- **Variable Count**: Most seeds generate 2 major continents, with some producing 1 or 3+

### Biome Distribution
Biomes follow Dwarf Fortress-style frequencies:
- **Ocean**: ~19-32% (including enforced boundaries)
- **Shallow Water**: ~6-7% (transition zones)
- **Tundra**: ~27-36% (most common land biome in cold regions)
- **Grassland**: ~24-28% (common temperate land biome)
- **Forest**: ~8-12% (moderate moisture areas)
- **Desert**: ~2-4% (hot, dry regions)
- **Mountain/Snow**: <1% (high elevation areas)
- **Beach**: <1% (coastal transition areas)

## Usage

### Running Unit Tests
```bash
npm run test:unit
```

Tests validate:
- Ocean boundary enforcement (all edges are ocean)
- 5% boundary width requirement
- Biome distribution matching DF patterns
- Continent separation and counting
- Toroidal wrap logic

### Generating Map Screenshots
```bash
npm run generate:screenshots [seed1] [seed2] ...
```

Examples:
```bash
# Generate with default seeds
npm run generate:screenshots

# Generate specific worlds
npm run generate:screenshots my_world test_continents ocean_test

# Direct script usage
node scripts/generate-map-screenshots.js diverse_world mountainous_realm
```

Screenshots are saved as PPM files in `map-screenshots/` directory. Convert to PNG using ImageMagick:
```bash
mogrify -format png map-screenshots/*.ppm
```

### Color Legend
Map screenshots use these colors:
- **Deep Blue** (#1e3a8a): Ocean
- **Light Blue** (#3b82f6): Shallow Water  
- **Sandy Yellow** (#fbbf24): Beach
- **Light Gray** (#e5e7eb): Tundra
- **Green** (#65a30d): Grassland
- **Dark Green** (#166534): Forest
- **Desert Yellow** (#eab308): Desert
- **Gray** (#6b7280): Mountain
- **White** (#f9fafb): Snow
- **Dark Teal** (#059669): Swamp

## Implementation Details

### Key Files Modified
- `src/map-generator/paginated.ts`: Enhanced continental generation with strict boundary enforcement
- `tests/unit-map-generation.js`: Comprehensive testing of all DF-style requirements
- `scripts/generate-map-screenshots.js`: Visual validation utility

### Technical Approach
1. **Boundary Enforcement**: Distance-based forcing ensures ocean within 50-pixel border
2. **Continental Patterns**: Dual noise layers create separate landmass clusters
3. **Biome Assignment**: Elevation, temperature, and moisture determine realistic biome placement
4. **Deterministic Generation**: Seed-based noise ensures reproducible worlds

### Validation
- All edge tiles guaranteed to be ocean
- Land/ocean ratio appropriate for DF-style gameplay
- Multiple distinct biomes present in most worlds
- Continental separation maintained for strategic gameplay
- Toroidal wrapping preserved with ocean boundaries