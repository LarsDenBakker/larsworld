# Development Workflow for LarsWorld

## Critical Reminders for AI Development

### Always Update Test Images Before Pushing
**⚠️ IMPORTANT**: Always regenerate and commit test images when making changes to the world generator:

```bash
# Always run this after any world generator changes
npm run test:generate-pngs
git add test/map-images/
```

The test images are now part of the test suite and must be kept up to date.

### Package Management
- **Always use `npm ci`** instead of `npm install` for clean, reproducible builds
- The `package-lock.json` file is tracked in git and should be committed

### Testing Workflow

#### Unit Tests (Fast - Run First)
```bash
npm run test:unit
```
This includes PNG generation as part of the test suite.

#### E2E Tests (Slower - Run After Unit Tests)
```bash
# Install playwright browsers if needed
npm run test:install

# Run E2E tests
npm run test:e2e
```

### Playwright vs Puppeteer Performance

**Current Status**: Using Playwright (@playwright/test@1.54.1)

**Performance Analysis**:
- Playwright is already installed and configured in the project
- Both Playwright and Puppeteer have similar performance for basic automation tasks
- Playwright offers additional benefits:
  - Better TypeScript support and type definitions
  - Multi-browser support (Chrome, Firefox, Safari)
  - More modern API design
  - Active development and Microsoft backing
  - Integrated with testing framework (@playwright/test)

**Decision**: Continue using Playwright as it's already configured and provides excellent performance.

**Fastest Playwright Setup**:
```bash
# Install browsers (run once or when Playwright updates)
npm run test:install

# For fastest E2E test execution
npm run test:e2e

# For development and debugging
npm run test:e2e:ui
```

**Note**: If browser installation fails in CI/sandboxed environments, Playwright can run in containerized mode or with system browsers.

### Test Images Specifications
- **Size**: 60×60 chunks = 960×960 tiles (921,600 total tiles)
- **Format**: Simple PNG only (elevation images removed)
- **Location**: `test/map-images/`
- **Seeds**: 10 predefined stable seeds for consistency
- **Integration**: PNG generation is part of the main test suite

### Build Process
```bash
# Clean install
npm ci

# Build TypeScript
npm run build

# Run all tests (unit + e2e)
npm test
```

### Ocean Coverage Testing
- For maps 60×60 chunks and larger: 25-35% ocean coverage requirement
- Smaller maps: no specific ocean coverage requirement
- Chunk-based generation may have variable coverage due to stateless nature

### Key Files to Update When Changing World Generator
1. `src/map-generator/` - Core generator logic
2. `test/world-generator-tests.js` - Unit tests
3. `test/stable-seed-pngs.js` - PNG generation (auto-run in tests)
4. `test/map-images/` - Test images (auto-generated)
5. `specs/world-generator.md` - Specifications

## Important Notes for AI
- Test images are now automatically generated during unit tests
- No more elevation images - only simple land/ocean visualizations
- Always validate ocean coverage for 60×60 chunk maps
- Use chunk-based generation exclusively (legacy removed)