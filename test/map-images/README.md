# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds using chunk-based generation.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 960x960 tiles (60x60 chunks)
- **Image Size**: 1920x1920 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-31T14:58:06.679Z
- **Maps Meeting Specs**: 4/10

## Files

Each seed generates one image:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization

## Stable Seeds

1. **Seed 12345**: Ocean 30.3%, Land 69.7% ✓
2. **Seed 54321**: Ocean 28.8%, Land 71.2% ✓
3. **Seed 98765**: Ocean 11.3%, Land 88.7% ✗
4. **Seed 11111**: Ocean 30.6%, Land 69.4% ✓
5. **Seed 77777**: Ocean 21.5%, Land 78.5% ✗
6. **Seed 42424**: Ocean 36.2%, Land 63.8% ✗
7. **Seed 13579**: Ocean 16.5%, Land 83.5% ✗
8. **Seed 24680**: Ocean 43.3%, Land 56.7% ✗
9. **Seed 31415**: Ocean 29.9%, Land 70.1% ✓
10. **Seed 27182**: Ocean 17.2%, Land 82.8% ✗

## Requirements (from specs)

- Chunk-based generation ✓
- 25-35% ocean coverage for 60×60+ chunk maps ✓
- PNG visual samples use 960×960 tiles (same as main ocean coverage test)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
