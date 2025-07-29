document.addEventListener('DOMContentLoaded', () => {
  const generatePaginatedBtn = document.getElementById('generate-paginated-btn');
  const mapContainer = document.getElementById('map-container');
  
  // Get input elements
  const seedInput = document.getElementById('seed-input');
  const pagesizeInput = document.getElementById('pagesize-input');
  const seedDisplay = document.getElementById('seed-display');
  const currentSeedSpan = document.getElementById('current-seed');
  const copySeedBtn = document.getElementById('copy-seed');
  
  // Legend toggle functionality
  const legendToggle = document.getElementById('legend-toggle');
  const legendContent = document.getElementById('legend-content');
  
  if (legendToggle && legendContent) {
    legendToggle.addEventListener('click', () => {
      const isExpanded = legendToggle.getAttribute('aria-expanded') === 'true';
      legendToggle.setAttribute('aria-expanded', !isExpanded);
      
      if (isExpanded) {
        legendContent.classList.remove('expanded');
        legendContent.classList.add('collapsed');
      } else {
        legendContent.classList.remove('collapsed');
        legendContent.classList.add('expanded');
      }
    });
    
    // Initialize mobile legend as collapsed
    if (window.innerWidth <= 767) {
      legendToggle.setAttribute('aria-expanded', 'false');
      legendContent.classList.add('collapsed');
    }
  }

  // Generate random seed function
  function generateRandomSeed() {
    const adjectives = ['brave', 'mystic', 'ancient', 'golden', 'silver', 'crystal', 'shadow', 'blazing', 'frozen', 'emerald'];
    const nouns = ['world', 'realm', 'land', 'empire', 'kingdom', 'continent', 'island', 'planet', 'domain', 'sanctuary'];
    const numbers = Math.floor(Math.random() * 9999) + 1;
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective}-${noun}-${numbers}`;
  }

  // Copy seed to clipboard
  copySeedBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentSeedSpan.textContent);
      copySeedBtn.textContent = '✓';
      setTimeout(() => {
        copySeedBtn.textContent = '📋';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy seed:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentSeedSpan.textContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      copySeedBtn.textContent = '✓';
      setTimeout(() => {
        copySeedBtn.textContent = '📋';
      }, 2000);
    }
  });

  // Add paginated map generation functionality
  generatePaginatedBtn.addEventListener('click', async () => {
    try {
      generatePaginatedBtn.disabled = true;
      generatePaginatedBtn.innerHTML = '<span class="btn-icon">⏳</span> Generating World...';
      
      // Get configuration from inputs - use random seed if empty
      let seed = seedInput.value.trim();
      if (!seed) {
        seed = generateRandomSeed();
      }
      
      const pageSize = parseInt(pagesizeInput.value) || 64;
      
      // Display the seed being used
      currentSeedSpan.textContent = seed;
      seedDisplay.style.display = 'flex';
      
      // Start paginated map generation
      await generatePaginatedMap({ seed, pageSize });
      
    } catch (error) {
      console.error('Error generating paginated map:', error);
      mapContainer.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 2rem;">Failed to generate map. Please try again.</p>';
    } finally {
      generatePaginatedBtn.disabled = false;
      generatePaginatedBtn.innerHTML = '<span class="btn-icon">🌍</span> Generate World';
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

        // Create progress indicator with modern styling
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.innerHTML = `
          <div class="progress-title">Generating World...</div>
          <div class="progress-bar-container">
            <div id="progress-bar"></div>
          </div>
          <div id="progress-text">Initializing...</div>
        `;
        mapContainer.appendChild(progressContainer);

        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        // Calculate display scale
        const maxDisplaySize = Math.min(window.innerWidth - 64, window.innerHeight - 200, 800);
        const scale = Math.min(maxDisplaySize / width, maxDisplaySize / height, 1);
        const tileSize = Math.max(1, Math.floor(scale));

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width * tileSize;
        canvas.height = height * tileSize;
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

        // Add completion info with modern styling
        const infoContainer = document.createElement('div');
        infoContainer.className = 'info-container';
        infoContainer.innerHTML = `
          <strong>World Generated Successfully!</strong><br>
          ${width}×${height} tiles • ${totalPages} pages<br>
          Seed: <strong>"${seed}"</strong><br>
          <small>Using paginated API (${tileSize}px per tile)</small>
        `;
        mapContainer.appendChild(infoContainer);

        resolve();

      } catch (error) {
        console.error('Paginated map generation failed:', error);
        mapContainer.innerHTML = `<div class="info-container" style="color: #ef4444; border-color: #fecaca;">
          <strong>Failed to generate map</strong><br>
          ${error.message}
        </div>`;
        reject(error);
      }
    });
  }
});