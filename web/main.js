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
        // Tile types as per API specification (only land and ocean)
        const TILE_TYPES = ['ocean', 'land'];
        
        // Biome types for enhanced visualization
        const BIOME_TYPES = [
          'deep_ocean', 'shallow_ocean', 'desert', 'tundra', 'arctic', 'swamp',
          'grassland', 'forest', 'taiga', 'savanna', 'tropical_forest', 'alpine'
        ];

        // Biome color palette with earth-like realistic colors
        const BIOME_COLORS = {
          deep_ocean: '#4169e1',      // Royal blue (was shallow ocean)
          shallow_ocean: '#87ceeb',   // Sky blue (lighter)
          desert: '#eecbad',          // Sandy beige
          tundra: '#b0c4de',          // Light steel blue
          arctic: '#f8f8ff',          // Ghost white
          swamp: '#556b2f',           // Dark olive green
          grassland: '#7cfc00',       // Lawn green
          forest: '#228b22',          // Forest green
          taiga: '#487648',           // Dark sea green
          savanna: '#bdb76b',         // Dark khaki
          tropical_forest: '#006400', // Dark green
          alpine: '#a9a9a9'           // Dark gray
        };
        
        /**
         * Apply elevation-based darkening to a color
         */
        function applyElevationShading(hexColor, elevation) {
          // Convert hex to RGB
          const r = parseInt(hexColor.slice(1, 3), 16);
          const g = parseInt(hexColor.slice(3, 5), 16);
          const b = parseInt(hexColor.slice(5, 7), 16);
          
          // Higher elevation = darker color (simulate shadows/altitude effects)
          const darkeningFactor = 1 - (elevation * 0.4); // Reduce up to 40% brightness at max elevation
          
          const shadedR = Math.floor(r * darkeningFactor);
          const shadedG = Math.floor(g * darkeningFactor);
          const shadedB = Math.floor(b * darkeningFactor);
          
          // Convert back to hex
          return '#' + [shadedR, shadedG, shadedB].map(x => x.toString(16).padStart(2, '0')).join('');
        }

        // Create enhanced progress indicator with detailed stages
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.innerHTML = `
          <div class="progress-header">
            <div class="progress-title">
              <span class="progress-icon">🌍</span>
              <span>Generating World...</span>
            </div>
            <div class="progress-stage" id="progress-stage">Initializing</div>
          </div>
          <div class="progress-bar-container">
            <div id="progress-bar" class="progress-bar-fill"></div>
            <div class="progress-percentage" id="progress-percentage">0%</div>
          </div>
          <div class="progress-details">
            <div id="progress-text" class="progress-status">Preparing world generation...</div>
            <div id="progress-eta" class="progress-eta"></div>
          </div>
        `;
        mapContainer.appendChild(progressContainer);

        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const progressStage = document.getElementById('progress-stage');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressEta = document.getElementById('progress-eta');

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

        // Fetch first page to determine total pages but also start parallel fetching
        progressStage.textContent = 'Initializing';
        progressText.textContent = 'Starting world generation...';
        
        // Start with 5 concurrent requests including the first page
        const initialConcurrency = 5;
        const initialPages = Array.from({length: initialConcurrency}, (_, i) => i);
        
        progressStage.textContent = 'Loading';
        progressText.textContent = `Starting parallel generation of ${initialConcurrency} sections...`;
        
        // Track timing for ETA calculation
        const startTime = Date.now();
        
        // Create parallel fetch promises for initial pages
        const initialPromises = initialPages.map(async (page) => {
          const pageUrl = `/api/map?page=${page}&pageSize=${pageSize}&seed=${encodeURIComponent(seed)}`;
          const response = await fetch(pageUrl);
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Page ${page}: ${error.error || `HTTP ${response.status}`}`);
          }

          const pageData = await response.json();
          return { page, pageData };
        });

        // Wait for initial batch to complete
        const initialResults = await Promise.all(initialPromises);
        
        // Sort by page number and get total pages from first result
        initialResults.sort((a, b) => a.page - b.page);
        const firstPageData = initialResults[0].pageData;
        const totalPages = firstPageData.totalPages;

        console.log(`Map will be generated in ${totalPages} pages, starting with ${initialConcurrency} concurrent requests`);

        // Add canvas to container
        mapContainer.appendChild(canvas);

        // Convert compact tile to full tile format
        function compactToTile(compact, x, y) {
          const elevation = compact.e / 255;
          const temperature = compact.tmp / 255;
          const moisture = compact.m / 255;
          const biome = BIOME_TYPES[compact.b];
          
          return {
            type: TILE_TYPES[compact.t], // Use 't' field for tile type index
            x,
            y,
            elevation,
            temperature,
            moisture,
            biome
          };
        }

        // Render a page of tiles
        function renderPage(pageData) {
          const { tiles, startY } = pageData;
          tiles.forEach((row, rowIndex) => {
            const y = startY + rowIndex;
            row.forEach((compactTile, x) => {
              const tile = compactToTile(compactTile, x, y);
              
              // Use biome color with elevation shading
              const baseColor = BIOME_COLORS[tile.biome] || '#888888'; // Fallback gray
              const color = applyElevationShading(baseColor, tile.elevation);
              
              ctx.fillStyle = color;
              ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            });
          });
        }

        // Render initial pages in order
        for (const { pageData } of initialResults) {
          renderPage(pageData);
        }

        let pagesComplete = initialResults.length;
        
        const updateProgress = () => {
          const progress = (pagesComplete / totalPages) * 100;
          const roundedProgress = Math.round(progress);
          
          // Animate progress bar
          progressBar.style.width = `${progress}%`;
          progressPercentage.textContent = `${roundedProgress}%`;
          
          // Update stage based on progress
          if (progress < 10) {
            progressStage.textContent = 'Initializing';
          } else if (progress < 30) {
            progressStage.textContent = 'Generating Terrain';
          } else if (progress < 70) {
            progressStage.textContent = 'Loading World Data';
          } else if (progress < 95) {
            progressStage.textContent = 'Rendering Map';
          } else {
            progressStage.textContent = 'Finalizing';
          }
          
          // Calculate and display ETA
          const elapsed = Date.now() - startTime;
          if (pagesComplete > 1 && progress > 5 && progress < 95) {
            const avgTimePerPage = elapsed / pagesComplete;
            const remainingPages = totalPages - pagesComplete;
            const etaMs = remainingPages * avgTimePerPage;
            const etaSeconds = Math.ceil(etaMs / 1000);
            
            if (etaSeconds > 0) {
              progressEta.textContent = `~${etaSeconds}s remaining`;
            }
          }
          
          // Update detailed progress text
          progressText.textContent = `Section ${pagesComplete} of ${totalPages} completed`;
        };

        updateProgress();

        // Continue fetching remaining pages if there are more than the initial batch
        if (totalPages > initialConcurrency) {
          // Fetch remaining pages in parallel with concurrency limit for improved performance
          const concurrencyLimit = 10; // Limit concurrent requests to avoid overwhelming the server
          const remainingPages = Array.from({length: totalPages - initialConcurrency}, (_, i) => i + initialConcurrency);
          
          // Process remaining pages in parallel batches
          for (let i = 0; i < remainingPages.length; i += concurrencyLimit) {
            const batch = remainingPages.slice(i, i + concurrencyLimit);
            const batchStart = batch[0] + 1;
            const batchEnd = batch[batch.length - 1] + 1;
            
            progressText.textContent = `Loading sections ${batchStart}-${batchEnd}...`;
            
            // Create parallel fetch promises for this batch
            const batchPromises = batch.map(async (page) => {
              const pageUrl = `/api/map?page=${page}&pageSize=${pageSize}&seed=${encodeURIComponent(seed)}`;
              const response = await fetch(pageUrl);
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(`Page ${page}: ${error.error || `HTTP ${response.status}`}`);
              }

              const pageData = await response.json();
              return { page, pageData };
            });

            try {
              // Wait for all pages in this batch to complete
              const batchResults = await Promise.all(batchPromises);
              
              // Sort by page number to ensure correct rendering order
              batchResults.sort((a, b) => a.page - b.page);
              
              // Render pages in order with smooth progress updates
              for (const { pageData } of batchResults) {
                renderPage(pageData);
                pagesComplete++;
                updateProgress();
                
                // Small delay for smooth visual feedback
                await new Promise(resolve => setTimeout(resolve, 5));
              }

            } catch (error) {
              console.error(`Failed to fetch batch starting at page ${batch[0]}:`, error);
              throw error;
            }
          }
        }

        // Final progress update
        progressStage.textContent = 'Complete';
        progressText.textContent = 'World generation completed!';
        progressEta.textContent = '';
        
        // Animate completion
        setTimeout(() => {
          progressContainer.classList.add('completed');
          setTimeout(() => {
            progressContainer.remove();
          }, 1000);
        }, 500);

        // Add completion info with modern styling
        const infoContainer = document.createElement('div');
        infoContainer.className = 'info-container';
        infoContainer.innerHTML = `
          <strong>World Generated Successfully!</strong><br>
          ${width}×${height} tiles • ${totalPages} sections<br>
          Seed: <strong>"${seed}"</strong><br>
          <small>Generated using parallel loading (${tileSize}px per tile)</small>
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