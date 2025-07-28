# End-to-End Testing with Playwright

This document describes how to run E2E tests for the LarsWorld application using Playwright.

## Overview

The E2E testing setup includes:
- **Playwright** with TypeScript support for browser automation
- **Netlify CLI** for deploying to preview environments
- Tests for main page functionality and map generation features
- Automated deployment and testing pipeline

## Prerequisites

1. **Node.js and npm** - Already installed in the project
2. **Playwright browsers** - Install with: `npm run test:install`
3. **Netlify CLI authentication** - Required for preview deployments

### Netlify CLI Setup

To run tests against Netlify preview environments, you need to authenticate with Netlify:

```bash
npx netlify login
```

This will open a browser window to authorize the CLI with your Netlify account.

## Available Test Commands

### Local Testing (Against Development Server)

```bash
# Run all E2E tests against local development server
npm run test:e2e

# Run tests with interactive UI
npm run test:e2e:ui

# Show test report (after running tests)
npm run test:report

# Install/update Playwright browsers
npm run test:install
```

### Preview Environment Testing

```bash
# Deploy to Netlify preview and run tests against deployed environment
npm run test:e2e:preview
```

This command:
1. Builds the project (`npm run build`)
2. Deploys to Netlify as a preview environment
3. Extracts the preview URL from Netlify CLI output
4. Waits for the deployment to be ready
5. Runs Playwright tests against the deployed URL

## Test Files

### `tests/e2e/main-page.spec.ts`
Tests for the main page functionality:
- Page loads successfully
- All UI elements are present and visible
- Legend displays all biome types correctly
- Proper styling and layout

### `tests/e2e/map-generation.spec.ts`
Tests for the map generation features:
- Generate button interaction
- Progress indicator during generation
- Canvas rendering of generated maps
- API connection handling
- Multiple map generations

## Configuration

### `playwright.config.ts`
Main Playwright configuration:
- **Base URL**: `http://localhost:3000` (override with `BASE_URL` env var)
- **Browser**: Chromium (can be extended to Firefox/Safari)
- **Timeouts**: 30s for actions and navigation
- **Traces**: Collected on first retry
- **Web Server**: Automatically starts local dev server for tests

### Environment Variables

- `BASE_URL`: Override the base URL for tests (used by preview testing)
- `SKIP_LOCAL_SERVER`: Skip starting local server (used by preview testing)
- `CI`: Enable CI-specific behavior (retries, parallel execution)

## Testing Locally

### 1. Standard Local Testing

```bash
# Start development server (if not already running)
npm start

# In another terminal, run tests
npm run test:e2e
```

The tests will automatically start the development server if it's not running.

### 2. Interactive Testing

For debugging and development:

```bash
npm run test:e2e:ui
```

This opens the Playwright Test UI where you can:
- Run individual tests
- See test execution in real-time
- Debug failing tests
- Inspect DOM and network requests

## Testing Against Netlify Preview

### Prerequisites for Preview Testing

1. **Netlify account** with access to the repository
2. **Authenticated Netlify CLI**: `npx netlify login`
3. **Project linked to Netlify**: Run `npx netlify link` if not already linked

### Running Preview Tests

```bash
npm run test:e2e:preview
```

**What happens:**
1. Project is built using `npm run build`
2. Code is deployed to a temporary Netlify preview environment
3. Script waits for deployment to be fully ready
4. Playwright tests run against the preview URL
5. Results are displayed

**Example output:**
```
🚀 Starting Netlify E2E Test Pipeline

🔨 Building project...
✅ Build completed successfully

🌐 Deploying to Netlify preview...
✅ Deployed successfully to: https://abc123-main-xyz789.netlify.app

🔍 Waiting for deployment to be ready...
✅ Deployment is ready!

🎭 Running Playwright tests against deployed environment...
✅ All tests passed successfully!

🎉 E2E testing completed for: https://abc123-main-xyz789.netlify.app
```

## CI/CD Integration

### GitHub Actions Example

Add this to `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright browsers
      run: npm run test:install
    
    - name: Run E2E tests (local)
      run: npm run test:e2e
    
    - name: Run E2E tests (preview)
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
      run: npm run test:e2e:preview
    
    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

**Required Secrets:**
- `NETLIFY_AUTH_TOKEN`: Your Netlify personal access token
- `NETLIFY_SITE_ID`: Your Netlify site ID

## Troubleshooting

### Common Issues

**1. Browser installation fails**

If you encounter download failures when running `npm run test:install`:

```bash
# Try alternative download
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=60000 npm run test:install

# Or use system Chrome/Chromium
sudo apt-get update && sudo apt-get install -y chromium-browser

# Set environment variable to use system browser
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_BROWSERS_PATH=/usr/bin
```

**Known Issue**: Some environments may have issues downloading Playwright browsers due to network configurations. In CI environments, you may need to use system-installed browsers or alternative download methods.

**2. Netlify authentication issues**
```bash
npx netlify logout
npx netlify login
```

**3. Deployment URL extraction fails**
- Check Netlify CLI output format
- Verify `netlify.toml` configuration
- Ensure project is properly linked: `npx netlify link`

**4. Tests timing out**
- Map generation can take 30-60 seconds
- Adjust timeouts in `playwright.config.ts` if needed
- Check network connectivity for preview deployments

**5. Local server issues**
- Ensure port 3000 is available
- Check for build errors: `npm run build`
- Verify all dependencies are installed: `npm install`

### Debug Mode

Run tests with debug information:

```bash
DEBUG=pw:api npm run test:e2e
```

### Headful Mode

See browser actions during test execution:

```bash
npx playwright test --headed
```

## Test Development

### Adding New Tests

1. Create test files in `tests/e2e/` with `.spec.ts` extension
2. Import test utilities: `import { test, expect } from '@playwright/test';`
3. Use descriptive test names and group related tests with `test.describe()`
4. Follow existing patterns for page interactions and assertions

### Best Practices

1. **Use data attributes** for reliable element selection
2. **Wait for elements** to be visible before interacting
3. **Test real user workflows** end-to-end
4. **Keep tests independent** - each test should work in isolation
5. **Use appropriate timeouts** for async operations (map generation)

### Example Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something specific', async ({ page }) => {
    await page.goto('/');
    
    // Arrange - set up test conditions
    const button = page.locator('#my-button');
    
    // Act - perform user actions
    await button.click();
    
    // Assert - verify expected outcomes
    await expect(page.locator('.result')).toBeVisible();
  });
});
```