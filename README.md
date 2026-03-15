# LarsWorld

A procedural world generator inspired by Dwarf Fortress and Minecraft, built collaboratively with AI. Generate deterministic, 960×960 tile worlds with realistic continents, rivers, biomes, and lakes — all from a single seed.

## Features

- **Procedural World Generation**: Multi-octave Perlin noise with domain warping produces realistic landmasses with 1–3 continents, irregular coastlines, and varied elevation
- **Biome System**: Climate-driven biomes including arctic, tundra, taiga, forest, tropical forest, savanna, desert, and swamp — distributed by latitude, elevation, and moisture
- **River System**: Deterministic rivers that follow elevation gradients with natural momentum-based curving, forming lakes at dead ends and river mouths
- **Interactive Canvas Map**: Real-time rendering with a color-coded legend and generation progress tracking
- **Chunk-based API**: Efficient 16×16 tile chunk delivery with pagination respecting 6MB response limits
- **Deterministic**: The same seed always produces the same world — share seeds to share worlds
- **Fast**: Full 960×960 tile map generated in under 5 seconds

## Getting Started

```bash
npm install
npm run build
npm start
```

The app will be available at `http://localhost:3000`.

## Development

### Development Server

```bash
# Start both backend API and hot-reloading frontend
npm run dev
```

### Build

```bash
npm run build          # Build server + web client
npm run build:server   # TypeScript → dist/
npm run build:web      # Rollup bundle → dist/web/
```

### Testing

```bash
npm run lint              # ESLint
npm run build             # TypeScript compile
npm run test:unit         # Unit tests (12 tests)
npm run test:e2e          # Playwright E2E tests
```

For component tests:

```bash
CHROME_PATH=/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome npm run test:unit:components
```

## Project Structure

```
src/
  map-generator/     # Core world generation algorithm
  server/            # Express API server
  shared/            # Shared types (server + client)
  netlify/functions/ # Serverless API handler
web/
  components/        # Lit web components (UI)
test/
  world-generator-tests.js  # Unit tests
  map-images/               # Reference PNG snapshots
tests/e2e/                  # Playwright E2E tests
specs/
  world-generator.md        # World generation specification
```

## Deployment

The project deploys to Netlify using serverless functions. See `.github/workflows/` for CI/CD configuration.
