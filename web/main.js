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
      generateBtn.textContent = 'Generating...';
      
      const response = await fetch('/api/generate-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          width: 30,
          height: 20
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
        
        // Enhanced tooltip with environmental data
        const elevation = Math.round(tile.elevation * 100);
        const temperature = Math.round(tile.temperature * 100);
        const rainfall = Math.round(tile.rainfall * 100);
        tileElement.title = `${tile.type} (${x}, ${y})\nElevation: ${elevation}%\nTemperature: ${temperature}%\nRainfall: ${rainfall}%`;
        
        mapContainer.appendChild(tileElement);
      }
    }
  }
});