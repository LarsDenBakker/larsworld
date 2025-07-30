# Stable Seed Map Images

This directory contains PNG images generated from 10 predefined stable seeds.
These images should be updated whenever the world generator algorithm changes.

## Generation Details

- **Map Size**: 200x200 tiles
- **Image Size**: 400x400 pixels (2x2 pixels per tile)
- **Generated**: 2025-07-30T12:15:38.488Z
- **Maps Meeting Specs**: 0/10

## Files

Each seed generates two images:
- `seed-{number}-simple.png`: Simple land (green) vs ocean (blue) visualization
- `seed-{number}-elevation.png`: Elevation-based coloring

## Stable Seeds

1. **Seed 12345**: Ocean 43.8%, Land 56.2% ✗
2. **Seed 54321**: Ocean 51.7%, Land 48.3% ✗
3. **Seed 98765**: Ocean 43.8%, Land 56.2% ✗
4. **Seed 11111**: Ocean 59.2%, Land 40.8% ✗
5. **Seed 77777**: Ocean 47.5%, Land 52.5% ✗
6. **Seed 42424**: Ocean 56.5%, Land 43.5% ✗
7. **Seed 13579**: Ocean 39.3%, Land 60.7% ✗
8. **Seed 24680**: Ocean 73.3%, Land 26.7% ✗
9. **Seed 31415**: Ocean 64.4%, Land 35.6% ✗
10. **Seed 27182**: Ocean 45.0%, Land 55.0% ✗

## Requirements (from specs)

- Maps must be square ✓
- 25-35% ocean coverage (0/10 maps meet this)
- Only 'land' and 'ocean' tile types ✓
- Deterministic generation with seeds ✓
- 1-3 continents separated by ocean
