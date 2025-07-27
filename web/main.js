document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generate-map-btn');
  const mapContainer = document.getElementById('map-container');

  // Add map generation functionality
  generateBtn.addEventListener('click', async () => {
    try {
      // Get width and height from input fields
      const widthInput = document.getElementById('map-width');
      const heightInput = document.getElementById('map-height');
      const width = parseInt(widthInput.value) || 50;
      const height = parseInt(heightInput.value) || 50;
      
      // Basic validation
      if (width < 10 || width > 200 || height < 10 || height > 200) {
        alert('Width and height must be between 10 and 200');
        return;
      }
      
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      
      const response = await fetch('/api/generate-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          width: width,
          height: height
        })
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
      generateBtn.textContent = 'Generate Map';
    }
  });

  /**
   * Renders the map as a grid of colored tiles
   */
  function renderMap(map, width, height) {
    mapContainer.innerHTML = '';
    mapContainer.style.gridTemplateColumns = `repeat(${width}, 16px)`;
    mapContainer.style.gridTemplateRows = `repeat(${height}, 16px)`;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];
        const tileElement = document.createElement('div');
        tileElement.className = `tile ${tile.type}`;
        
        // Enhanced tooltip with climate data
        const elevation = Math.round(tile.elevation * 100);
        const temperature = Math.round(tile.temperature * 100);
        const moisture = Math.round(tile.moisture * 100);
        tileElement.title = `${tile.type.replace('_', ' ')} (${x}, ${y})\nElevation: ${elevation}%\nTemperature: ${temperature}%\nMoisture: ${moisture}%`;
        
        mapContainer.appendChild(tileElement);
      }
    }
  }
});