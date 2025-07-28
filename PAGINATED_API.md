# Map Generation API

This implementation provides a pagination-based map generation system that generates realistic 1000×1000 earthlike worlds with continental patterns.

## Features

- ✅ **Fixed 1000×1000 Maps**: All maps are generated at exactly 1000×1000 tiles
- ✅ **Paginated API**: GET endpoints with `page`, `pageSize`, and `seed` parameters
- ✅ **6MB Limit Protection**: Automatic payload size validation and optimal page sizing
- ✅ **Stateless & Deterministic**: Same coordinates + seed = identical tiles every time
- ✅ **Compact JSON**: Minimal tile data using numeric indices and scaled values
- ✅ **Realistic Continents**: Usually 2 large continents, ~45% land coverage (1.5× Earth's ratio)
- ✅ **Clear Ocean/Land Separation**: Distinct visual boundaries between continents and oceans
- ✅ **Shared Types**: TypeScript interfaces used by both server and client
- ✅ **Dependency-light**: Simple implementation using standard web APIs

## API Endpoint

```
GET /api/map?page=0&pageSize=64&seed=abc
```

### Parameters

- `page` (number): Zero-based page index
- `pageSize` (number): Number of rows per page (1-1000)
- `seed` (string): Deterministic seed for world generation

### Response Format

```typescript
{
  page: number;           // Current page index
  pageSize: number;       // Actual page size used
  totalPages: number;     // Total pages for complete map
  seed: string;           // Generation seed
  startY: number;         // Starting Y coordinate of this page
  endY: number;           // Ending Y coordinate of this page
  tiles: CompactTile[][]; // 2D array of compact tile data
  sizeBytes: number;      // Actual payload size in bytes
}
```

### Compact Tile Format

Instead of verbose tile objects, we use a minimal format:

```typescript
// Verbose format (original): ~150 bytes per tile
{
  type: "grassland",
  x: 42,
  y: 17,
  elevation: 0.654,
  temperature: 0.721,
  moisture: 0.433
}

// Compact format: ~25 bytes per tile
{
  b: 4,    // Biome index (0-9): grassland = 4
  e: 167,  // Elevation (0-255): 0.654 * 255 = 167
  t: 184,  // Temperature (0-255): 0.721 * 255 = 184
  m: 110   // Moisture (0-255): 0.433 * 255 = 110
}
```

## Usage Examples

### Basic Client Usage

```typescript
import { generatePaginatedMap } from './paginated-map';

// Generate a 1000x1000 world in 16 pages
const mapData = await generatePaginatedMap({
  seed: 'my-world-123',
  pageSize: 64,
  onProgress: (page, total) => console.log(`${page}/${total}`),
  onComplete: (total) => console.log(`Generated ${total} pages`)
});
```

### Real-time Rendering

```typescript
// Render each page as it arrives for streaming effect
await generatePaginatedMap({
  seed: 'streaming-demo',
  pageSize: 32,
  onPageReceived: (response) => {
    renderMapPage(canvas, response); // Draw immediately
  }
});
```

### Manual API Calls

```typescript
// Fetch individual pages
const page0 = await fetch('/api/map?page=0&pageSize=64&seed=test');
const page1 = await fetch('/api/map?page=1&pageSize=64&seed=test');

// Same seed + coordinates = identical results
const response = await page0.json();
console.log(response.totalPages); // 16 for 1000x1000 with pageSize 64
console.log(response.sizeBytes);  // ~1.6MB per page
```

## Payload Size Management

The system automatically ensures payloads stay under 6MB for 1000×1000 maps:

```typescript
// Calculate optimal page size for 1000x1000 maps
const optimalPageSize = calculateOptimalPageSize(); // ~240 rows
const estimate = estimateMapSize(64);

console.log({
  totalPages: estimate.totalPages,        // 16 pages
  pageSize: estimate.estimatedPageSize,   // ~1.6MB per page
  isUnderLimit: estimate.isUnderLimit     // true
});
```

## Error Handling

```typescript
// 413 response for oversized payloads
{
  "error": "Payload too large",
  "details": "Generated 7.2MB, exceeds 6MB limit"
}

// 400 response for invalid parameters
{
  "error": "Map generation failed",
  "details": "Page size must be between 1 and 1000"
}
```

## Performance Characteristics

| Page Size | Total Pages | Page Size | Total Time |
|-----------|-------------|-----------|------------|
| 64        | 16          | ~1.6MB    | ~8s        |
| 32        | 32          | ~800KB    | ~16s       |
| 16        | 63          | ~400KB    | ~32s       |

*All measurements for 1000×1000 maps*

## Continental Generation Features

- **Realistic Land Coverage**: ~45% land (1.5× Earth's ~30% ratio)
- **Continental Patterns**: Usually 2 large continents, rarely 1 huge or 3+ smaller ones  
- **Clear Boundaries**: Distinct visual separation between ocean and land
- **Diverse Biomes**: Mountains, forests, deserts, grasslands naturally distributed
- **Deterministic**: Same seed always produces identical continental patterns

## Implementation Files

- `src/shared/types.ts` - Shared TypeScript interfaces
- `src/map-generator/paginated.ts` - Stateless map generation logic
- `src/server/router.ts` - Express.js API handler
- `src/client/paginated-map.ts` - Client-side utilities
- `examples/typescript-examples.ts` - Complete usage examples

## Key Benefits

1. **Fixed Size**: All maps are exactly 1000×1000 for consistency
2. **Netlify Compatible**: All responses < 6MB
3. **Deterministic**: Same seed produces identical worlds
4. **Realistic Continents**: Enhanced algorithm for earthlike patterns  
5. **Efficient**: 85% smaller payloads vs verbose format
6. **Progressive**: Users see results as they're generated
7. **Simple**: Standard HTTP GET requests, no WebSockets/SSE required