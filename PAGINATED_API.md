# Paginated Map Generation API

This implementation provides a pagination-based map generation system that respects Netlify's 6MB response size limit while enabling the generation of large procedural worlds.

## Features

- ✅ **Paginated API**: GET endpoints with `page`, `pageSize`, `width`, `height`, and `seed` parameters
- ✅ **6MB Limit Protection**: Automatic payload size validation and optimal page sizing
- ✅ **Stateless & Deterministic**: Same coordinates + seed = identical tiles every time
- ✅ **Compact JSON**: Minimal tile data using numeric indices and scaled values
- ✅ **Shared Types**: TypeScript interfaces used by both server and client
- ✅ **Streaming-like Experience**: Sequential page requests with real-time rendering
- ✅ **Dependency-light**: Simple implementation using standard web APIs

## API Endpoint

```
GET /api/map?page=0&pageSize=64&width=256&height=256&seed=abc
```

### Parameters

- `page` (number): Zero-based page index
- `pageSize` (number): Number of rows per page (1-256)
- `width` (number): Map width in tiles (1-10000)
- `height` (number): Map height in tiles (1-10000)  
- `seed` (string): Deterministic seed for world generation

### Response Format

```typescript
{
  page: number;           // Current page index
  pageSize: number;       // Actual page size used
  totalPages: number;     // Total pages for complete map
  width: number;          // Map width
  height: number;         // Map height
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

// Generate a 256x256 world in 4 pages
const mapData = await generatePaginatedMap({
  width: 256,
  height: 256,
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
  width: 512,
  height: 512,
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
const page0 = await fetch('/api/map?page=0&pageSize=64&width=256&height=256&seed=test');
const page1 = await fetch('/api/map?page=1&pageSize=64&width=256&height=256&seed=test');

// Same seed + coordinates = identical results
const response = await page0.json();
console.log(response.totalPages); // 4
console.log(response.sizeBytes);  // ~487KB per page
```

## Payload Size Management

The system automatically ensures payloads stay under 6MB:

```typescript
// Calculate optimal page size for any width
const optimalPageSize = calculateOptimalPageSize(1024); // ~245 rows
const estimate = estimateMapSize(1024, 1024, 32);

console.log({
  totalPages: estimate.totalPages,        // 32 pages
  pageSize: estimate.estimatedPageSize,   // ~819KB per page
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
  "details": "Width must be between 1 and 10000"
}
```

## Performance Characteristics

| Map Size | Page Size | Total Pages | Page Size | Total Time |
|----------|-----------|-------------|-----------|------------|
| 256×256  | 64        | 4           | ~487KB    | ~2s        |
| 512×512  | 32        | 16          | ~478KB    | ~8s        |
| 1024×1024| 16        | 64          | ~470KB    | ~32s       |

## Implementation Files

- `src/shared/types.ts` - Shared TypeScript interfaces
- `src/map-generator/paginated.ts` - Stateless map generation logic
- `src/server/router.ts` - Express.js API handler
- `src/client/paginated-map.ts` - Client-side utilities
- `examples/typescript-examples.ts` - Complete usage examples

## Key Benefits

1. **Netlify Compatible**: All responses < 6MB
2. **Deterministic**: Same seed produces identical worlds
3. **Scalable**: Generate maps of any size through pagination
4. **Efficient**: 85% smaller payloads vs verbose format
5. **Progressive**: Users see results as they're generated
6. **Simple**: Standard HTTP GET requests, no WebSockets/SSE required