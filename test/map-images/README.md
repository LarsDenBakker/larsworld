# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds using chunk-based generation.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 96x96 tiles (6x6 chunks)
- **Image Size**: 192x192 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-30T18:42:21.477Z
- **Maps Meeting Specs**: 0/10

## Files

Each seed generates two images:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization
- `seed-{number}-elevation.png`: Elevation-based coloring

## Stable Seeds

1. **Seed 12345**: Ocean 37.3%, Land 62.7% ✗
2. **Seed 54321**: Ocean 98.8%, Land 1.2% ✗
3. **Seed 98765**: Ocean 23.3%, Land 76.7% ✗
4. **Seed 11111**: Ocean 97.6%, Land 2.4% ✗
5. **Seed 77777**: Ocean 99.6%, Land 0.4% ✗
6. **Seed 42424**: Ocean 36.6%, Land 63.4% ✗
7. **Seed 13579**: Ocean 0.6%, Land 99.4% ✗
8. **Seed 24680**: Ocean 98.6%, Land 1.4% ✗
9. **Seed 31415**: Ocean 0.0%, Land 100.0% ✗
10. **Seed 27182**: Ocean 21.6%, Land 78.4% ✗

## Requirements (from specs)

- Chunk-based generation ✓
- 25-35% ocean coverage for 96×96+ maps (0/10 maps meet this)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
