# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds using chunk-based generation.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 64x64 tiles (4x4 chunks)
- **Image Size**: 128x128 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-30T19:18:25.635Z
- **Maps Meeting Specs**: 1/10

## Files

Each seed generates two images:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization
- `seed-{number}-elevation.png`: Elevation-based coloring

## Stable Seeds

1. **Seed 12345**: Ocean 32.5%, Land 67.5% ✓
2. **Seed 54321**: Ocean 97.3%, Land 2.7% ✗
3. **Seed 98765**: Ocean 39.2%, Land 60.8% ✗
4. **Seed 11111**: Ocean 98.1%, Land 1.9% ✗
5. **Seed 77777**: Ocean 99.0%, Land 1.0% ✗
6. **Seed 42424**: Ocean 62.4%, Land 37.6% ✗
7. **Seed 13579**: Ocean 1.4%, Land 98.6% ✗
8. **Seed 24680**: Ocean 96.8%, Land 3.2% ✗
9. **Seed 31415**: Ocean 0.0%, Land 100.0% ✗
10. **Seed 27182**: Ocean 21.8%, Land 78.2% ✗

## Requirements (from specs)

- Chunk-based generation ✓
- 25-35% ocean coverage for 60×60+ maps (1/10 maps meet this)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
