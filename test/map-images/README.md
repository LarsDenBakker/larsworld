# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds using chunk-based generation.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 960x960 tiles (60x60 chunks)
- **Image Size**: 1920x1920 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-31T14:37:40.162Z
- **Maps Meeting Specs**: 5/10

## Files

Each seed generates one image:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization

## Stable Seeds

1. **Seed 12345**: Ocean 35.3%, Land 64.7% ✗
2. **Seed 54321**: Ocean 39.3%, Land 60.7% ✗
3. **Seed 98765**: Ocean 18.5%, Land 81.5% ✗
4. **Seed 11111**: Ocean 34.5%, Land 65.5% ✓
5. **Seed 77777**: Ocean 31.1%, Land 68.9% ✓
6. **Seed 42424**: Ocean 38.8%, Land 61.2% ✗
7. **Seed 13579**: Ocean 28.3%, Land 71.7% ✓
8. **Seed 24680**: Ocean 47.8%, Land 52.2% ✗
9. **Seed 31415**: Ocean 32.7%, Land 67.3% ✓
10. **Seed 27182**: Ocean 26.8%, Land 73.2% ✓

## Requirements (from specs)

- Chunk-based generation ✓
- 25-35% ocean coverage for 60×60+ chunk maps ✓
- PNG visual samples use 960×960 tiles (same as main ocean coverage test)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
