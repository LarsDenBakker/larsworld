# larsworld

Just playground trying to create a game together with AI

## Development

### Getting Started

```bash
npm install
npm run build
npm start
```

The application will be available at `http://localhost:3000`.

### Build Process

The project uses a two-step build process:

1. **Server Build**: TypeScript compilation of server-side code to `dist/`
2. **Web Build**: Rollup bundling of client-side TypeScript/Lit components to `dist/web/`

```bash
# Build everything (server + web)
npm run build

# Build just the server
npm run build:server

# Build just the web client
npm run build:web
```

### Development Server

For development, use the development server which provides hot-reloading:

```bash
# Start both backend API and frontend dev server
npm run dev

# Start just the frontend dev server (requires backend running separately)
npm run dev:web
```

### Testing

This project includes comprehensive end-to-end (E2E) testing using Playwright.

#### Quick Start
```bash
# Install test dependencies
npm run test:install

# Run E2E tests locally
npm run test:e2e

# Run tests against Netlify preview deployment
npm run test:e2e:preview
```

> **Note**: If browser installation fails, see [E2E_TESTING.md](E2E_TESTING.md#troubleshooting) for alternative installation methods.

#### Documentation
See [E2E_TESTING.md](E2E_TESTING.md) for detailed testing documentation, including:
- Local and CI testing setup
- Netlify preview environment testing
- Troubleshooting guide
- Test development best practices

## Features

- **World Generation**: Generate procedural 1000×1000 earthlike worlds with realistic continental patterns
- **Interactive Map**: Canvas-based rendering with real-time generation progress
- **Paginated API**: Efficient map loading through pagination system respecting 6MB limits
- **Production Build**: Rollup-based bundling for optimized deployment
- **Netlify Deployment**: Serverless functions for scalable API hosting
