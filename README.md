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

- **World Generation**: Generate procedural earth-like worlds with various biomes
- **Interactive Map**: Canvas-based rendering with real-time generation progress
- **Server-Sent Events**: Streaming world generation for better user experience
- **Netlify Deployment**: Serverless functions for scalable API hosting
