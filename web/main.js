document.addEventListener('DOMContentLoaded', () => {
  const appDiv = document.getElementById('app');
  const generateBtn = document.getElementById('generate-map-btn');
  const mapContainer = document.getElementById('map-container');

  // Initialize the app with the existing ping functionality
  fetch('/api/ping')
    .then(response => response.json())
    .then(data => {
      appDiv.textContent = data.message;
    })
    .catch(error => {
      console.error('Error fetching ping:', error);
      appDiv.textContent = 'Failed to fetch data from server.';
    });

  // Add map generation functionality
  generateBtn.addEventListener('click', async () => {
    try {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating World...';
      
      // Start streaming map generation
      await generateMapWithStreaming();
      
    } catch (error) {
      console.error('Error generating map:', error);
      mapContainer.innerHTML = '<p style="color: red;">Failed to generate map. Please try again.</p>';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate World';
    }
  });

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