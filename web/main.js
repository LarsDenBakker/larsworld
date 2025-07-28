document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generate-map-btn');
  const generatePaginatedBtn = document.getElementById('generate-paginated-btn');
  const mapContainer = document.getElementById('map-container');
  
  // Get input elements
  const widthInput = document.getElementById('width-input');
  const heightInput = document.getElementById('height-input');
  const seedInput = document.getElementById('seed-input');
  const pagesizeInput = document.getElementById('pagesize-input');

  // Add map generation functionality (existing SSE approach)
  generateBtn.addEventListener('click', async () => {
    try {
      generateBtn.disabled = true;
      generatePaginatedBtn.disabled = true;
      generateBtn.textContent = 'Generating World...';
      
      // Start streaming map generation
      await generateMapWithStreaming();
      
    } catch (error) {
      console.error('Error generating map:', error);
      mapContainer.innerHTML = '<p style="color: red;">Failed to generate map. Please try again.</p>';
    } finally {
      generateBtn.disabled = false;
      generatePaginatedBtn.disabled = false;
      generateBtn.textContent = 'Generate World (SSE)';
    }
  });

  // Add paginated map generation functionality
  generatePaginatedBtn.addEventListener('click', async () => {
    try {
      generatePaginatedBtn.disabled = true;
      generateBtn.disabled = true;
      generatePaginatedBtn.textContent = 'Generating World...';
      
      // Get configuration from inputs
      const width = parseInt(widthInput.value) || 256;
      const height = parseInt(heightInput.value) || 256;
      const seed = seedInput.value || 'demo-seed-123';
      const pageSize = parseInt(pagesizeInput.value) || 64;
      
      // Start paginated map generation
      await generatePaginatedMap({ width, height, seed, pageSize });
      
    } catch (error) {
      console.error('Error generating paginated map:', error);
      mapContainer.innerHTML = '<p style="color: red;">Failed to generate map. Please try again.</p>';
    } finally {
      generatePaginatedBtn.disabled = false;
      generateBtn.disabled = false;
      generatePaginatedBtn.textContent = 'Generate World (Paginated)';
    }
  });

  /**
   * Generate map using paginated API
   */
  async function generatePaginatedMap({ width, height, seed, pageSize }) {
    return new Promise(async (resolve, reject) => {
      try {
        mapContainer.innerHTML = '';
        
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
        const firstPageUrl = `/api/map?page=0&pageSize=${pageSize}&width=${width}&height=${height}&seed=${encodeURIComponent(seed)}`;
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
            const pageUrl = `/api/map?page=${page}&pageSize=${pageSize}&width=${width}&height=${height}&seed=${encodeURIComponent(seed)}`;
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

  /**
   * Generate map using Server-Sent Events for streaming chunks
   */
  async function generateMapWithStreaming() {
    return new Promise((resolve, reject) => {
      mapContainer.innerHTML = '';
      
      let canvas = null;
      let ctx = null;
      let mapData = [];
      let mapWidth = 0;
      let mapHeight = 0;
      let scale = 1;
      let totalChunks = 0;
      let chunksReceived = 0;
      
      // Create progress indicator
      const progressContainer = document.createElement('div');
      progressContainer.style.marginBottom = '20px';
      progressContainer.innerHTML = `
        <div style="background: #f3f4f6; border-radius: 4px; padding: 15px;">
          <div style="margin-bottom: 10px; font-weight: bold;">Generating Earthlike World...</div>
          <div style="background: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;">
            <div id="progress-bar" style="background: #3b82f6; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
          </div>
          <div id="progress-text" style="margin-top: 10px; font-size: 14px; color: #6b7280;">Initializing...</div>
        </div>
      `;
      mapContainer.appendChild(progressContainer);
      
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');

      // Color mapping for biomes
      const colors = {
        ocean: '#1E3A8A',
        shallow_water: '#3B82F6',
        beach: '#FDE68A',
        desert: '#F59E0B',
        grassland: '#84CC16',
        forest: '#166534',
        tundra: '#A3A3A3',
        mountain: '#525252',
        snow: '#F8FAFC',
        swamp: '#365314'
      };

      // Start Server-Sent Events
      const eventSource = new EventSource('/api/generate-map');
      
      eventSource.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'start':
              mapWidth = data.width;
              mapHeight = data.height;
              totalChunks = data.totalChunks;
              mapData = new Array(mapHeight);
              
              // Initialize canvas
              const maxDisplaySize = 800;
              scale = Math.min(maxDisplaySize / mapWidth, maxDisplaySize / mapHeight);
              
              canvas = document.createElement('canvas');
              canvas.width = mapWidth * scale;
              canvas.height = mapHeight * scale;
              canvas.style.border = '2px solid #333';
              canvas.style.borderRadius = '4px';
              canvas.style.display = 'block';
              canvas.style.margin = '0 auto';
              
              ctx = canvas.getContext('2d');
              ctx.fillStyle = '#1E3A8A'; // Ocean background
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              mapContainer.appendChild(canvas);
              
              progressText.textContent = `Generating continent patterns... (0/${totalChunks} chunks)`;
              break;
              
            case 'chunk':
              chunksReceived++;
              const progress = (chunksReceived / totalChunks) * 100;
              progressBar.style.width = `${progress}%`;
              progressText.textContent = `Generated ${chunksReceived}/${totalChunks} chunks (${Math.round(progress)}%)`;
              
              // Store chunk data
              for (let i = 0; i < data.rows.length; i++) {
                mapData[data.startY + i] = data.rows[i];
              }
              
              // Render chunk to canvas
              for (let y = data.startY; y < data.endY; y++) {
                for (let x = 0; x < mapWidth; x++) {
                  const tile = mapData[y][x];
                  ctx.fillStyle = colors[tile.type] || '#000000';
                  ctx.fillRect(x * scale, y * scale, scale, scale);
                }
              }
              break;
              
            case 'complete':
              eventSource.close();
              
              // Update progress to complete
              progressBar.style.width = '100%';
              progressText.textContent = 'World generation complete!';
              
              // Remove progress after a short delay and add map info
              setTimeout(() => {
                progressContainer.remove();
                
                const info = document.createElement('div');
                info.style.marginTop = '10px';
                info.style.fontSize = '14px';
                info.style.color = '#666';
                info.style.textAlign = 'center';
                info.innerHTML = `World Size: ${mapWidth} × ${mapHeight} tiles (displaying at ${Math.round(scale * 100)}% scale)`;
                mapContainer.appendChild(info);
                
                resolve();
              }, 1500);
              break;
              
            case 'error':
              eventSource.close();
              progressContainer.remove();
              reject(new Error(data.error));
              break;
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
          eventSource.close();
          reject(error);
        }
      };
      
      eventSource.onerror = function(error) {
        console.error('SSE connection error:', error);
        eventSource.close();
        progressContainer.remove();
        reject(new Error('Connection to server lost'));
      };
    });
  }

  /**
   * Legacy function for rendering complete maps (kept for compatibility)
   */
  function renderMap(map, width, height) {
    mapContainer.innerHTML = '';
    
    // For large maps, create a canvas for efficient rendering
    const canvas = document.createElement('canvas');
    const maxDisplaySize = 800; // Max size for display
    
    // Calculate scale to fit in display area
    const scale = Math.min(maxDisplaySize / width, maxDisplaySize / height);
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.border = '2px solid #333';
    canvas.style.borderRadius = '4px';
    
    const ctx = canvas.getContext('2d');
    
    // Color mapping for biomes
    const colors = {
      ocean: '#1E3A8A',
      shallow_water: '#3B82F6',
      beach: '#FDE68A',
      desert: '#F59E0B',
      grassland: '#84CC16',
      forest: '#166534',
      tundra: '#A3A3A3',
      mountain: '#525252',
      snow: '#F8FAFC',
      swamp: '#365314'
    };
    
    // Render map to canvas
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];
        ctx.fillStyle = colors[tile.type] || '#000000';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    
    mapContainer.appendChild(canvas);
    
    // Add map info
    const info = document.createElement('div');
    info.style.marginTop = '10px';
    info.style.fontSize = '14px';
    info.style.color = '#666';
    info.innerHTML = `World Size: ${width} × ${height} tiles (displaying at ${Math.round(scale * 100)}% scale)`;
    mapContainer.appendChild(info);
  }
});