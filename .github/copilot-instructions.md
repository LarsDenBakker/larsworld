We are creating a game inspired by games like dwarf fortress, minecraft. We currently focus on creating a map generator to create worlds for the game. The worlds are based on square tiles and should generate realistic worlds covering different biomes, climates and landscapes.

The project is built using typescript. Favoring simple, basic and simple code favoring standard javascript / typescript over complex libraries or frameworks. However libraries which follow similar principles and substantially reduced code size are OK to add.

The UI should be modern, basic and simple on mobile while more detailed and oriented towards power users on desktop. The UI should not mention any technical terminologies.

All specs for the project are placed in the specs. update it accordingly when changing the implementation

When making changes to the map generator, test it first using node js on the raw functions only. Then on the generated images using the node js cli. This is much faster than the browser UI. verify it in the browser only after implementation.

## Development Workflow Instructions for Copilot

### Critical Reminders for AI Development

#### Always Update Test Images Before Pushing
**⚠️ IMPORTANT**: Always regenerate and commit test images when making changes to the world generator:

```bash
# Always run this after any world generator changes
npm run test:generate-pngs
git add test/map-images/
```

The test images are now part of the test suite and must be kept up to date.

#### Package Management
- **Always use `npm ci`** instead of `npm install` for clean, reproducible builds
- The `package-lock.json` file is tracked in git and should be committed

#### Playwright Setup (WORKING CONFIGURATION)
**✅ WORKING SETUP**: System browser approach configured and tested

**Configuration**: 
- Modified `playwright.config.ts` to use `channel: 'chrome'` to use system Chrome browser
- This avoids download issues and works reliably in sandboxed environments
- No need to run `npm run test:install` - uses existing system browser

**Commands**:
```bash
# Run E2E tests (using system Chrome)
npm run test:e2e

# For development and debugging
npm run test:e2e:ui

# View test reports
npm run test:report
```

**Key Insight**: The browser download often fails in sandboxed environments. Using the system browser via `channel: 'chrome'` is the most reliable approach.

#### Testing Workflow

**Unit Tests (Fast - Run First)**:
```bash
npm run test:unit
```
This includes PNG generation as part of the test suite.

**E2E Tests (Slower - Run After Unit Tests)**:
```bash
npm run test:e2e
```
No browser installation needed - uses system Chrome.

#### Performance Analysis - Playwright vs Puppeteer
**Decision**: Continue using Playwright with system browser
- Playwright is already installed and configured  
- System browser approach eliminates download issues
- Better TypeScript support and type definitions
- Multi-browser support available when needed
- More modern API design
- Active development and Microsoft backing

#### Test Images Specifications
- **Size**: 60×60 chunks = 960×960 tiles (921,600 total tiles)
- **Format**: Simple PNG only (elevation images removed)
- **Location**: `test/map-images/`
- **Seeds**: 10 predefined stable seeds for consistency
- **Integration**: PNG generation is part of the main test suite

#### Build Process
```bash
# Clean install
npm ci

# Build TypeScript  
npm run build

# Run all tests (unit + e2e)
npm test
```

#### Ocean Coverage Testing
- For maps 60×60 chunks and larger: 25-35% ocean coverage requirement
- Smaller maps: no specific ocean coverage requirement
- Chunk-based generation may have variable coverage due to stateless nature

#### Key Files to Update When Changing World Generator
1. `src/map-generator/` - Core generator logic
2. `test/world-generator-tests.js` - Unit tests
3. `test/stable-seed-pngs.js` - PNG generation (auto-run in tests)
4. `test/map-images/` - Test images (auto-generated)
5. `specs/world-generator.md` - Specifications

#### Important Notes for AI
- Test images are now automatically generated during unit tests
- No more elevation images - only simple land/ocean visualizations
- Always validate ocean coverage for 60×60 chunk maps
- Use chunk-based generation exclusively (legacy removed)
- Playwright configured to use system browser - no downloads needed
