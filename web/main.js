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
      
      const response = await fetch('/api/generate-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      renderMap(data.map, data.width, data.height);
      
    } catch (error) {
      console.error('Error generating map:', error);
      mapContainer.innerHTML = '<p style="color: red;">Failed to generate map. Please try again.</p>';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate World';
    }
  });

  /**
   * Renders the map using canvas for better performance with large maps
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