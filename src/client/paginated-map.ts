/**
 * Client-side paginated map generation
 * Fetches map data in pages and renders them as they arrive
 */

// Import shared types (in a real app, these would be imported from a shared package)
import { MapPageResponse, CompactTile, BIOME_TYPES, compactToTile } from '../shared/types.js';

interface MapGenerationConfig {
  seed: string;
  pageSize: number;
  onProgress?: (page: number, totalPages: number) => void;
  onPageReceived?: (response: MapPageResponse) => void;
  onComplete?: (totalPages: number) => void;
  onError?: (error: Error) => void;
}

interface MapRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  tileSize: number;
}

/**
 * Biome color mapping for rendering
 */
const BIOME_COLORS: Record<string, string> = {
  ocean: '#1e40af',
  shallow_water: '#3b82f6',
  beach: '#fbbf24',
  desert: '#f59e0b',
  grassland: '#22c55e',
  forest: '#16a34a',
  tundra: '#f3f4f6',
  mountain: '#6b7280',
  snow: '#ffffff',
  swamp: '#059669'
};

/**
 * Fetch a single page of map data from the API
 */
async function fetchMapPage(page: number, pageSize: number, seed: string): Promise<MapPageResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    seed: seed
  });

  const response = await fetch(`/api/map?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Create a canvas renderer for the map
 */
function createMapRenderer(width: number, height: number, container: HTMLElement): MapRenderer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Calculate scale to fit in container (max 800px)
  const maxSize = 800;
  const scale = Math.min(maxSize / width, maxSize / height, 1);
  const tileSize = Math.max(1, Math.floor(scale));

  canvas.width = width * tileSize;
  canvas.height = height * tileSize;
  canvas.style.border = '1px solid #ccc';
  canvas.style.imageRendering = 'pixelated';

  container.appendChild(canvas);

  return { canvas, ctx, scale, tileSize };
}

/**
 * Render a page of map data to the canvas
 */
function renderMapPage(renderer: MapRenderer, response: MapPageResponse): void {
  const { ctx, tileSize } = renderer;
  const { tiles, startY } = response;
  const width = 1000; // Fixed width for all maps

  tiles.forEach((row, rowIndex) => {
    const y = startY + rowIndex;
    row.forEach((compactTile, x) => {
      const tile = compactToTile(compactTile, x, y);
      const color = BIOME_COLORS[tile.type] || '#888888';
      
      ctx.fillStyle = color;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    });
  });
}

/**
 * Generate and render a complete map using pagination
 */
export async function generatePaginatedMap(config: MapGenerationConfig, container: HTMLElement): Promise<void> {
  const { seed, pageSize, onProgress, onPageReceived, onComplete, onError } = config;
  
  // Fixed dimensions for all maps
  const width = 1000;
  const height = 1000;

  try {
    // Clear container
    container.innerHTML = '';

    // Create progress indicator
    const progressContainer = document.createElement('div');
    progressContainer.style.marginBottom = '20px';
    progressContainer.innerHTML = `
      <div style="background: #f3f4f6; border-radius: 4px; padding: 15px;">
        <div style="margin-bottom: 10px; font-weight: bold;">Generating Map with Pagination...</div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;">
          <div id="progress-bar" style="background: #3b82f6; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
        <div id="progress-text" style="margin-top: 10px; font-size: 14px; color: #6b7280;">Initializing...</div>
      </div>
    `;
    container.appendChild(progressContainer);

    const progressBar = progressContainer.querySelector('#progress-bar') as HTMLElement;
    const progressText = progressContainer.querySelector('#progress-text') as HTMLElement;

    // Get first page to determine total pages
    progressText.textContent = 'Fetching first page...';
    const firstPage = await fetchMapPage(0, pageSize, seed);
    const totalPages = firstPage.totalPages;

    console.log(`Map will be generated in ${totalPages} pages`);

    // Create renderer
    const renderer = createMapRenderer(width, height, container);

    // Render first page
    renderMapPage(renderer, firstPage);
    onPageReceived?.(firstPage);

    let pagesComplete = 1;
    const updateProgress = () => {
      const progress = (pagesComplete / totalPages) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `Page ${pagesComplete} of ${totalPages} (${Math.round(progress)}%)`;
      onProgress?.(pagesComplete, totalPages);
    };

    updateProgress();

    // Fetch remaining pages sequentially
    for (let page = 1; page < totalPages; page++) {
      try {
        progressText.textContent = `Fetching page ${page + 1}...`;
        const pageResponse = await fetchMapPage(page, pageSize, seed);
        
        // Render page
        renderMapPage(renderer, pageResponse);
        onPageReceived?.(pageResponse);

        pagesComplete++;
        updateProgress();

        // Small delay to allow UI updates and simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (error) {
        console.error(`Failed to fetch page ${page}:`, error);
        throw error;
      }
    }

    // Remove progress indicator
    progressContainer.remove();

    // Add completion info
    const infoContainer = document.createElement('div');
    infoContainer.style.marginBottom = '10px';
    infoContainer.innerHTML = `
      <div style="font-size: 14px; color: #6b7280;">
        Map generated: 1000×1000 tiles, seed: "${seed}", ${totalPages} pages
      </div>
    `;
    container.insertBefore(infoContainer, renderer.canvas);

    onComplete?.(totalPages);

  } catch (error) {
    console.error('Map generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    container.innerHTML = `<p style="color: red;">Failed to generate map: ${errorMessage}</p>`;
    onError?.(error as Error);
  }
}

/**
 * Calculate estimated payload sizes for different configurations for 1000x1000 maps
 */
export function calculatePayloadEstimate(pageSize: number): {
  totalPages: number;
  estimatedPageSize: number;
  totalSize: number;
} {
  const width = 1000; // Fixed width
  const height = 1000; // Fixed height
  const totalPages = Math.ceil(height / pageSize);
  const tilesPerPage = width * pageSize;
  const estimatedPageSize = tilesPerPage * 25; // ~25 bytes per compact tile
  const totalSize = totalPages * estimatedPageSize;

  return {
    totalPages,
    estimatedPageSize,
    totalSize
  };
}

/**
 * Example usage and API demonstration
 */
export function demonstratePaginatedMapAPI() {
  console.log('=== Paginated Map API Examples ===');
  
  // Example 1: Standard configuration
  const standardConfig = {
    seed: 'example-seed-123',
    pageSize: 64
  };
  
  const standardEstimate = calculatePayloadEstimate(standardConfig.pageSize);
  console.log('Standard Map (1000×1000):', {
    config: standardConfig,
    estimate: standardEstimate,
    url: `/api/map?page=0&pageSize=${standardConfig.pageSize}&seed=${standardConfig.seed}`
  });

  // Example 2: Large page size
  const largePageConfig = {
    seed: 'large-page-456',
    pageSize: 32
  };
  
  const largePageEstimate = calculatePayloadEstimate(largePageConfig.pageSize);
  console.log('Large Page Map (1000×1000):', {
    config: largePageConfig,
    estimate: largePageEstimate,
    url: `/api/map?page=0&pageSize=${largePageConfig.pageSize}&seed=${largePageConfig.seed}`
  });

  // Example 3: Maximum safe page size for 6MB limit
  const maxSafePageSize = Math.floor((6 * 1024 * 1024 - 1000) / (1000 * 25)); // Conservative estimate
  console.log('Maximum safe page size for 1000x1000 map:', maxSafePageSize);
}