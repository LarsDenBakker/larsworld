# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds using chunk-based generation.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 960x960 tiles (60x60 chunks)
- **Image Size**: 1920x1920 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-31T19:42:27.638Z
- **Maps Meeting Specs**: 4/10

## Files

Each seed generates one image:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization

## Stable Seeds

1. **Seed 12345**: Ocean 29.4%, Land 70.6% ✓
2. **Seed 54321**: Ocean 28.2%, Land 71.8% ✓
3. **Seed 98765**: Ocean 10.8%, Land 89.2% ✗
4. **Seed 11111**: Ocean 30.2%, Land 69.8% ✓
5. **Seed 77777**: Ocean 21.6%, Land 78.4% ✗
6. **Seed 42424**: Ocean 35.1%, Land 64.9% ✗
7. **Seed 13579**: Ocean 15.9%, Land 84.1% ✗
8. **Seed 24680**: Ocean 41.1%, Land 58.9% ✗
9. **Seed 31415**: Ocean 29.4%, Land 70.6% ✓
10. **Seed 27182**: Ocean 17.0%, Land 83.0% ✗

## Requirements (from specs)

- Chunk-based generation ✓
- 25-35% ocean coverage for 60×60+ chunk maps ✓
- PNG visual samples use 960×960 tiles (same as main ocean coverage test)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
