# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 200x200 tiles
- **Image Size**: 400x400 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-30T11:25:02.957Z
- **Maps Meeting Specs**: 1/10

## Files

Each seed generates two images:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization
- `seed-{number}-elevation.png`: Elevation-based coloring

## Stable Seeds

1. **Seed 12345**: Ocean 52.1%, Land 47.9% ✗
2. **Seed 54321**: Ocean 51.0%, Land 49.0% ✗
3. **Seed 98765**: Ocean 55.7%, Land 44.3% ✗
4. **Seed 11111**: Ocean 51.4%, Land 48.6% ✗
5. **Seed 77777**: Ocean 41.2%, Land 58.8% ✗
6. **Seed 42424**: Ocean 53.5%, Land 46.5% ✗
7. **Seed 13579**: Ocean 50.9%, Land 49.1% ✗
8. **Seed 24680**: Ocean 30.7%, Land 69.3% ✓
9. **Seed 31415**: Ocean 35.0%, Land 65.0% ✗
10. **Seed 27182**: Ocean 42.8%, Land 57.2% ✗

## Requirements (from specs)

- Maps must be square ✓
- 25-35% ocean coverage (1/10 maps meet this)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
