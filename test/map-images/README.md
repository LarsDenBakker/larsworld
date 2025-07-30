# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 200x200 tiles
- **Image Size**: 400x400 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-30T17:55:47.886Z
- **Maps Meeting Specs**: 10/10

## Files

Each seed generates two images:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization
- `seed-{number}-elevation.png`: Elevation-based coloring

## Stable Seeds

1. **Seed 12345**: Ocean 30.0%, Land 70.0% ✓
2. **Seed 54321**: Ocean 30.0%, Land 70.0% ✓
3. **Seed 98765**: Ocean 30.0%, Land 70.0% ✓
4. **Seed 11111**: Ocean 30.0%, Land 70.0% ✓
5. **Seed 77777**: Ocean 30.0%, Land 70.0% ✓
6. **Seed 42424**: Ocean 30.0%, Land 70.0% ✓
7. **Seed 13579**: Ocean 30.0%, Land 70.0% ✓
8. **Seed 24680**: Ocean 30.0%, Land 70.0% ✓
9. **Seed 31415**: Ocean 30.0%, Land 70.0% ✓
10. **Seed 27182**: Ocean 30.0%, Land 70.0% ✓

## Requirements (from specs)

- Maps must be square ✓
- 25-35% ocean coverage (10/10 maps meet this)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
