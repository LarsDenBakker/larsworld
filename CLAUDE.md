# Claude Code Instructions for LarsWorld

## Environment Setup

This project runs in a sandboxed environment. Before running tests, ensure dependencies are installed:

```bash
npm ci
```

## Required Before Every Push

Run these commands in order. All must pass before pushing:

```bash
npm run lint        # ESLint - must have 0 errors
npm run build       # TypeScript compilation + rollup bundle
npm run test:unit   # Unit tests (12 tests, ~60s)
```

For full validation (slower):

```bash
CHROME_PATH=/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome npm run test:unit:components
npm run test:e2e    # Requires no servers on ports 3000/3001
```

## Playwright / Browser Setup

The environment has Chromium pre-installed at:
- Full browser: `/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`
- Headless shell: `/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell`

Symlinks are created at the playwright-expected paths (1181 → 1194):
- `/root/.cache/ms-playwright/chromium_headless_shell-1181/` → points to 1194

**If symlinks are missing**, recreate them:
```bash
mkdir -p /root/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/
ln -sf /root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell \
  /root/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell
cp /root/.cache/ms-playwright/chromium_headless_shell-1194/INSTALLATION_COMPLETE \
  /root/.cache/ms-playwright/chromium_headless_shell-1181/INSTALLATION_COMPLETE
cp /root/.cache/ms-playwright/chromium_headless_shell-1194/DEPENDENCIES_VALIDATED \
  /root/.cache/ms-playwright/chromium_headless_shell-1181/DEPENDENCIES_VALIDATED
```

For web-test-runner component tests, set CHROME_PATH:
```bash
CHROME_PATH=/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome npm run test:unit:components
```

## E2E Tests

E2E tests auto-start both servers via playwright webServer config. If ports 3000/3001 are in use, free them first:
```bash
fuser -k 3000/tcp 2>/dev/null; fuser -k 3001/tcp 2>/dev/null
```

To run E2E tests with pre-started servers (faster):
```bash
npm start &
npm run dev:web &
sleep 8
SKIP_LOCAL_SERVER=true npm run test:e2e
```

## Linting

ESLint is configured in `eslint.config.js` with separate rules for:
- `src/**/*.ts`, `netlify/**/*.ts` — TypeScript server/API files (Node.js globals)
- `web/**/*.ts` — TypeScript browser files (browser globals)
- `test/**/*.js` — Node.js test files
- `test/unit/**/*.js` — Browser component tests (mocha globals)
- `scripts/**/*.js`, `*.js` — Node.js config/scripts

Fix lint issues automatically:
```bash
npm run lint:fix
```

## Pre-commit Hook

Husky runs on every commit:
1. `npm run lint` — ESLint check
2. `npm run build` — TypeScript compile
3. `npm run test:unit` — Unit tests

These must all pass for the commit to succeed.

## World Generator Changes

When changing `src/map-generator/`:
1. Run `npm run test:unit` to verify unit tests pass
2. Run `npm run test:generate-pngs` to regenerate test images
3. Commit the updated `test/map-images/` files
4. Verify with `npm run test:verify-pngs`

## Project Structure

```
src/
  map-generator/     # Core world generation algorithm
  server/            # Express API server
  shared/            # Shared types (server + client)
  netlify/functions/ # Serverless API handler
web/
  components/        # Lit web components (UI)
  index.html         # HTML template (dev only)
test/
  world-generator-tests.js  # Main unit tests
  stable-seed-pngs.js       # PNG generation (runs in test:unit)
  unit/components.test.js   # Web component tests
  map-images/               # Reference PNG images (committed)
scripts/
  verify-stable-pngs.js     # CI PNG verification
tests/e2e/                  # Playwright E2E tests
```

## CI/CD

GitHub Actions workflows (`.github/workflows/`):
- `unit-tests.yml` — lint + build + unit tests + PNG verification
- `e2e-playwright.yml` — lint + build + PNG verification + E2E tests

Both run on push/PR to `main`.
