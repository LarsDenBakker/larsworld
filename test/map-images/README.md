# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 200x200 tiles
- **Image Size**: 400x400 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-30T11:21:01.180Z
- **Maps Meeting Specs**: 3/10

## Files

Each seed generates two images:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization
- `seed-{number}-elevation.png`: Elevation-based coloring

## Stable Seeds

1. **Seed 12345**: Ocean 44.8%, Land 55.2% ✗
2. **Seed 54321**: Ocean 44.5%, Land 55.5% ✗
3. **Seed 98765**: Ocean 46.5%, Land 53.5% ✗
4. **Seed 11111**: Ocean 42.5%, Land 57.5% ✗
5. **Seed 77777**: Ocean 32.1%, Land 67.9% ✓
6. **Seed 42424**: Ocean 46.4%, Land 53.6% ✗
7. **Seed 13579**: Ocean 42.3%, Land 57.7% ✗
8. **Seed 24680**: Ocean 19.4%, Land 80.6% ✗
9. **Seed 31415**: Ocean 25.4%, Land 74.6% ✓
10. **Seed 27182**: Ocean 33.0%, Land 67.0% ✓

## Requirements (from specs)

- Maps must be square ✓
- 25-35% ocean coverage (3/10 maps meet this)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
