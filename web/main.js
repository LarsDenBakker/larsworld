document.addEventListener('DOMContentLoaded', () => {
  const generatePaginatedBtn = document.getElementById('generate-paginated-btn');
  const mapContainer = document.getElementById('map-container');
  
  // Get input elements
  const seedInput = document.getElementById('seed-input');
  const pagesizeInput = document.getElementById('pagesize-input');

  // Add paginated map generation functionality
  generatePaginatedBtn.addEventListener('click', async () => {
    try {
      generatePaginatedBtn.disabled = true;
      generatePaginatedBtn.textContent = 'Generating World...';
      
      // Get configuration from inputs
      const seed = seedInput.value || 'demo-seed-123';
      const pageSize = parseInt(pagesizeInput.value) || 64;
      
      // Start paginated map generation
      await generatePaginatedMap({ seed, pageSize });
      
    } catch (error) {
      console.error('Error generating paginated map:', error);
      mapContainer.innerHTML = '<p style="color: red;">Failed to generate map. Please try again.</p>';
    } finally {
      generatePaginatedBtn.disabled = false;
      generatePaginatedBtn.textContent = 'Generate World';
    }
  });

  /**
   * Generate map using paginated API
   */
  async function generatePaginatedMap({ seed, pageSize }) {
    return new Promise(async (resolve, reject) => {
      try {
        mapContainer.innerHTML = '';
        
        // Fixed dimensions for 1000x1000 maps
        const width = 1000;
        const height = 1000;
        // Biome types for converting compact format
        const BIOME_TYPES = [
          'ocean', 'shallow_water', 'beach', 'desert', 'grassland',
          'forest', 'tundra', 'mountain', 'snow', 'swamp'
        ];

        // Color mapping for biomes
        const colors = {
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
        mapContainer.appendChild(progressContainer);

        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        // Calculate display scale
        const maxDisplaySize = 800;
        const scale = Math.min(maxDisplaySize / width, maxDisplaySize / height, 1);
        const tileSize = Math.max(1, Math.floor(scale));

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width * tileSize;
        canvas.height = height * tileSize;
        canvas.style.border = '1px solid #ccc';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';

        const ctx = canvas.getContext('2d');

        // Fetch first page to determine total pages
        progressText.textContent = 'Fetching first page...';
        const firstPageUrl = `/api/map?page=0&pageSize=${pageSize}&seed=${encodeURIComponent(seed)}`;
        const firstResponse = await fetch(firstPageUrl);
        
        if (!firstResponse.ok) {
          const error = await firstResponse.json();
          throw new Error(error.error || `HTTP ${firstResponse.status}`);
        }

        const firstPage = await firstResponse.json();
        const totalPages = firstPage.totalPages;

        console.log(`Map will be generated in ${totalPages} pages, first page size: ${Math.round(firstPage.sizeBytes / 1024)}KB`);

        // Add canvas to container
        mapContainer.appendChild(canvas);

        // Convert compact tile to full tile format
        function compactToTile(compact, x, y) {
          return {
            type: BIOME_TYPES[compact.b],
            x,
            y,
            elevation: compact.e / 255,
            temperature: compact.t / 255,
            moisture: compact.m / 255
          };
        }

        // Render a page of tiles
        function renderPage(pageData) {
          const { tiles, startY } = pageData;
          tiles.forEach((row, rowIndex) => {
            const y = startY + rowIndex;
            row.forEach((compactTile, x) => {
              const tile = compactToTile(compactTile, x, y);
              const color = colors[tile.type] || '#888888';
              
              ctx.fillStyle = color;
              ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            });
          });
        }

        // Render first page
        renderPage(firstPage);

        let pagesComplete = 1;
        const updateProgress = () => {
          const progress = (pagesComplete / totalPages) * 100;
          progressBar.style.width = `${progress}%`;
          progressText.textContent = `Page ${pagesComplete} of ${totalPages} (${Math.round(progress)}%)`;
        };

        updateProgress();

        // Fetch remaining pages sequentially
        for (let page = 1; page < totalPages; page++) {
          try {
            progressText.textContent = `Fetching page ${page + 1}...`;
            const pageUrl = `/api/map?page=${page}&pageSize=${pageSize}&seed=${encodeURIComponent(seed)}`;
            const response = await fetch(pageUrl);
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || `HTTP ${response.status}`);
            }

            const pageData = await response.json();
            
            // Render page
            renderPage(pageData);

            pagesComplete++;
            updateProgress();

            // Small delay to allow UI updates
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
        infoContainer.style.marginTop = '10px';
        infoContainer.style.fontSize = '14px';
        infoContainer.style.color = '#6b7280';
        infoContainer.style.textAlign = 'center';
        infoContainer.innerHTML = `
          Map generated: ${width}×${height} tiles, seed: "${seed}", ${totalPages} pages<br>
          Using paginated API (${tileSize}px per tile)
        `;
        mapContainer.appendChild(infoContainer);

        resolve();

      } catch (error) {
        console.error('Paginated map generation failed:', error);
        mapContainer.innerHTML = `<p style="color: red;">Failed to generate map: ${error.message}</p>`;
        reject(error);
      }
    });
  }
});