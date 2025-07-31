/**
 * Chunk-based World Map Generator
 * Uses vanilla JavaScript for cross-environment compatibility
 * Fetches 16×16 chunks diagonally with parallel loading and real-time rendering
 */
class ChunkWorldMap {
  constructor() {
    // Configuration
    this.CHUNK_SIZE = 16;
    this.MAX_PARALLEL_REQUESTS = 5;
    this.MAX_RESPONSE_SIZE = 6 * 1024 * 1024; // 6MB
    this.TILE_SIZE = 4; // Pixels per tile for rendering

    // State
    this.isGenerating = false;
    this.isPaused = false;
    this.seed = '';
    this.minX = 0;
    this.maxX = 9;
    this.minY = 0;
    this.maxY = 9;
    this.progress = 0;
    this.totalChunks = 0;
    this.loadedChunks = 0;
    this.currentStatus = '';

    // Map rendering state
    this.mapCanvas = null;
    this.mapContext = null;
    this.chunkData = new Map();
    this.loadingQueue = [];
    this.activeRequests = 0;

    // Biome colors matching the existing system
    this.BIOME_COLORS = {
      deep_ocean: '#4169e1',
      shallow_ocean: '#6496e6',
      desert: '#eecbad',
      tundra: '#b0c4de',
      arctic: '#f8f8ff',
      swamp: '#556b2f',
      grassland: '#7cfc00',
      forest: '#228b22',
      taiga: '#487648',
      savanna: '#bdb76b',
      tropical_forest: '#006400',
      alpine: '#a9a9a9'
    };

    this.BIOME_TYPES = [
      'deep_ocean', 'shallow_ocean', 'desert', 'tundra', 'arctic', 'swamp',
      'grassland', 'forest', 'taiga', 'savanna', 'tropical_forest', 'alpine'
    ];

    this.init();
  }

  init() {
    this.createUI();
    this.bindEvents();
  }

  createUI() {
    const container = document.createElement('div');
    container.className = 'chunk-map-container';
    container.innerHTML = `
      <div class="container">
        <header class="header">
          <h1>LarsWorld</h1>
          <p class="subtitle">Chunk-Based World Generator</p>
        </header>

        <div class="controls">
          <div class="coordinates-grid">
            <div class="coordinate-group">
              <label for="min-x">Min X</label>
              <input id="min-x" type="number" value="0">
            </div>
            <div class="coordinate-group">
              <label for="max-x">Max X</label>
              <input id="max-x" type="number" value="9">
            </div>
            <div class="coordinate-group">
              <label for="min-y">Min Y</label>
              <input id="min-y" type="number" value="0">
            </div>
            <div class="coordinate-group">
              <label for="max-y">Max Y</label>
              <input id="max-y" type="number" value="9">
            </div>
          </div>

          <div class="seed-group">
            <label for="seed">World Name (optional)</label>
            <input id="seed" type="text" value="" placeholder="Leave empty for random name">
          </div>

          <div class="action-buttons">
            <button id="start-btn" class="btn btn-primary">
              <span>🌍</span>
              <span class="btn-text">Start Generation</span>
            </button>
            <button id="pause-btn" class="btn btn-secondary" disabled>
              <span>⏸️</span>
              <span class="btn-text">Pause</span>
            </button>
          </div>
        </div>

        <div id="progress-section" class="progress-section" style="display: none;">
          <div class="progress-header">
            <div class="progress-title">Generating World</div>
            <div id="progress-count">0/0 chunks</div>
          </div>
          <div class="progress-bar-container">
            <div id="progress-bar" class="progress-bar"></div>
          </div>
          <div id="progress-text" class="progress-text">Initializing...</div>
        </div>

        <div class="map-container">
          <div id="map-placeholder" class="map-placeholder">
            Configure coordinates and click "Start Generation" to create your world
          </div>
          <canvas id="map-canvas" class="map-canvas" style="display: none;"></canvas>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .chunk-map-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
      }

      .header {
        text-align: center;
        margin-bottom: 2rem;
        color: white;
      }

      .header h1 {
        font-size: clamp(2rem, 5vw, 3.5rem);
        font-weight: 700;
        margin-bottom: 0.5rem;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }

      .subtitle {
        font-size: 1.1rem;
        opacity: 0.9;
        font-weight: 300;
      }

      .controls {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 2rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        border: 1px solid rgba(255,255,255,0.2);
      }

      .coordinates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .coordinate-group, .seed-group {
        display: flex;
        flex-direction: column;
      }

      .coordinate-group label, .seed-group label {
        font-weight: 600;
        color: #374151;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
      }

      .coordinate-group input, .seed-group input {
        padding: 0.75rem;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.2s ease;
      }

      .coordinate-group input:focus, .seed-group input:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }

      .seed-group {
        margin-bottom: 1.5rem;
      }

      .action-buttons {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .btn {
        padding: 1rem 2rem;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        min-width: 150px;
        justify-content: center;
      }

      .btn-primary {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        box-shadow: 0 4px 16px rgba(79, 70, 229, 0.3);
      }

      .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
      }

      .btn-secondary {
        background: #6b7280;
        color: white;
        box-shadow: 0 4px 16px rgba(107, 114, 128, 0.3);
      }

      .btn-secondary:hover:not(:disabled) {
        background: #4b5563;
        transform: translateY(-2px);
      }

      .btn:disabled {
        background: #9ca3af;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .progress-section {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .progress-title {
        font-weight: 600;
        color: #374151;
      }

      .progress-bar-container {
        background: #e5e7eb;
        border-radius: 8px;
        height: 8px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }

      .progress-bar {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        height: 100%;
        width: 0%;
        transition: width 0.3s ease;
        border-radius: 8px;
      }

      .progress-text {
        font-size: 0.9rem;
        color: #6b7280;
      }

      .map-container {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 1.5rem;
        text-align: center;
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .map-placeholder {
        color: #6b7280;
        font-size: 1.1rem;
      }

      .map-canvas {
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        max-width: 100%;
        height: auto;
        image-rendering: pixelated;
        opacity: 0;
        animation: fadeIn 0.5s ease-in-out forwards;
      }

      @keyframes fadeIn {
        to { opacity: 1; }
      }

      .error {
        color: #ef4444;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
      }

      @media (max-width: 768px) {
        .coordinates-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        
        .action-buttons {
          flex-direction: column;
        }
        
        .btn {
          flex: none;
          min-width: auto;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.insertBefore(container, document.body.firstChild);
  }

  bindEvents() {
    // Input event listeners
    document.getElementById('min-x').addEventListener('input', (e) => {
      this.minX = parseInt(e.target.value) || 0;
    });

    document.getElementById('max-x').addEventListener('input', (e) => {
      this.maxX = parseInt(e.target.value) || 0;
    });

    document.getElementById('min-y').addEventListener('input', (e) => {
      this.minY = parseInt(e.target.value) || 0;
    });

    document.getElementById('max-y').addEventListener('input', (e) => {
      this.maxY = parseInt(e.target.value) || 0;
    });

    document.getElementById('seed').addEventListener('input', (e) => {
      this.seed = e.target.value;
    });

    // Button event listeners
    document.getElementById('start-btn').addEventListener('click', () => {
      this.startGeneration();
    });

    document.getElementById('pause-btn').addEventListener('click', () => {
      this.togglePause();
    });
  }

  async startGeneration() {
    // Get current coordinate values
    this.minX = parseInt(document.getElementById('min-x').value) || 0;
    this.maxX = parseInt(document.getElementById('max-x').value) || 0;
    this.minY = parseInt(document.getElementById('min-y').value) || 0;
    this.maxY = parseInt(document.getElementById('max-y').value) || 0;
    this.seed = document.getElementById('seed').value.trim();

    // Validate coordinates
    if (this.maxX < this.minX || this.maxY < this.minY) {
      alert('Max coordinates must be greater than or equal to min coordinates');
      return;
    }

    // Calculate total chunks and check size limit
    const chunkCountX = this.maxX - this.minX + 1;
    const chunkCountY = this.maxY - this.minY + 1;
    this.totalChunks = chunkCountX * chunkCountY;
    
    // Estimate size (rough calculation: each chunk ~10KB, check against 6MB limit)
    const estimatedSize = this.totalChunks * 10 * 1024; // 10KB per chunk estimate
    if (estimatedSize > this.MAX_RESPONSE_SIZE) {
      const maxChunks = Math.floor(this.MAX_RESPONSE_SIZE / (10 * 1024));
      alert(`Too many chunks! Maximum ~${maxChunks} chunks to stay under 6MB limit. You selected ${this.totalChunks} chunks.`);
      return;
    }

    // Generate random seed if empty
    if (!this.seed) {
      this.seed = this.generateRandomSeed();
      document.getElementById('seed').value = this.seed;
    }

    this.isGenerating = true;
    this.isPaused = false;
    this.loadedChunks = 0;
    this.progress = 0;
    this.chunkData.clear();
    this.activeRequests = 0;

    // Update UI
    this.updateUI();

    // Initialize canvas
    this.initializeCanvas();

    // Create loading queue in diagonal order (top-left to bottom-right)
    this.loadingQueue = this.createDiagonalQueue();
    this.currentStatus = 'Starting chunk generation...';
    this.updateProgress();

    // Start loading chunks
    this.processLoadingQueue();
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.updateUI();
    
    if (!this.isPaused) {
      this.processLoadingQueue();
    }
  }

  updateUI() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const progressSection = document.getElementById('progress-section');

    // Update start button
    const btnText = startBtn.querySelector('.btn-text');
    if (this.isGenerating && !this.isPaused) {
      btnText.textContent = 'Generating...';
      startBtn.disabled = true;
    } else {
      btnText.textContent = 'Start Generation';
      startBtn.disabled = false;
    }

    // Update pause button
    const pauseBtnText = pauseBtn.querySelector('.btn-text');
    const pauseBtnIcon = pauseBtn.querySelector('span');
    if (this.isGenerating) {
      pauseBtn.disabled = false;
      if (this.isPaused) {
        pauseBtnText.textContent = 'Resume';
        pauseBtnIcon.textContent = '▶️';
      } else {
        pauseBtnText.textContent = 'Pause';
        pauseBtnIcon.textContent = '⏸️';
      }
    } else {
      pauseBtn.disabled = true;
      pauseBtnText.textContent = 'Pause';
      pauseBtnIcon.textContent = '⏸️';
    }

    // Show/hide progress section
    progressSection.style.display = this.isGenerating ? 'block' : 'none';

    // Disable inputs during generation
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      input.disabled = this.isGenerating;
    });
  }

  updateProgress() {
    document.getElementById('progress-count').textContent = `${this.loadedChunks}/${this.totalChunks} chunks`;
    document.getElementById('progress-bar').style.width = `${this.progress}%`;
    document.getElementById('progress-text').textContent = this.currentStatus;
  }

  generateRandomSeed() {
    const adjectives = ['brave', 'mystic', 'ancient', 'golden', 'silver', 'crystal', 'shadow', 'blazing', 'frozen', 'emerald'];
    const nouns = ['world', 'realm', 'land', 'empire', 'kingdom', 'continent', 'island', 'planet', 'domain', 'sanctuary'];
    const numbers = Math.floor(Math.random() * 9999) + 1;
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective}-${noun}-${numbers}`;
  }

  initializeCanvas() {
    const canvas = document.getElementById('map-canvas');
    const placeholder = document.getElementById('map-placeholder');
    
    const chunkCountX = this.maxX - this.minX + 1;
    const chunkCountY = this.maxY - this.minY + 1;
    
    canvas.width = chunkCountX * this.CHUNK_SIZE * this.TILE_SIZE;
    canvas.height = chunkCountY * this.CHUNK_SIZE * this.TILE_SIZE;
    
    this.mapContext = canvas.getContext('2d');
    this.mapContext.fillStyle = '#e5e7eb'; // Light gray background
    this.mapContext.fillRect(0, 0, canvas.width, canvas.height);

    // Show canvas, hide placeholder
    placeholder.style.display = 'none';
    canvas.style.display = 'block';
  }

  createDiagonalQueue() {
    const queue = [];
    const chunkCountX = this.maxX - this.minX + 1;
    const chunkCountY = this.maxY - this.minY + 1;
    
    // Create diagonal traversal order
    for (let sum = 0; sum < chunkCountX + chunkCountY - 1; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x < chunkCountX && y < chunkCountY) {
          queue.push({
            chunkX: this.minX + x,
            chunkY: this.minY + y,
            localX: x,
            localY: y
          });
        }
      }
    }
    
    return queue;
  }

  async processLoadingQueue() {
    while (this.loadingQueue.length > 0 && 
           this.activeRequests < this.MAX_PARALLEL_REQUESTS && 
           !this.isPaused) {
      
      const chunkInfo = this.loadingQueue.shift();
      this.loadChunk(chunkInfo);
    }
  }

  async loadChunk(chunkInfo) {
    this.activeRequests++;
    
    try {
      const response = await fetch(`/api/chunk?chunkX=${chunkInfo.chunkX}&chunkY=${chunkInfo.chunkY}&seed=${encodeURIComponent(this.seed)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load chunk (${chunkInfo.chunkX}, ${chunkInfo.chunkY}): ${response.status}`);
      }

      const chunkData = await response.json();
      
      // Check response size
      const responseSize = JSON.stringify(chunkData).length;
      if (responseSize > this.MAX_RESPONSE_SIZE) {
        throw new Error(`Chunk response too large: ${Math.round(responseSize / 1024 / 1024)}MB`);
      }

      // Store chunk data
      this.chunkData.set(`${chunkInfo.chunkX},${chunkInfo.chunkY}`, chunkData);
      
      // Render chunk with fade-in animation
      this.renderChunk(chunkData, chunkInfo);
      
      // Update progress
      this.loadedChunks++;
      this.progress = (this.loadedChunks / this.totalChunks) * 100;
      this.currentStatus = `Loaded chunk (${chunkInfo.chunkX}, ${chunkInfo.chunkY}) - ${this.loadedChunks}/${this.totalChunks}`;
      this.updateProgress();

      // Check if generation is complete
      if (this.loadedChunks >= this.totalChunks) {
        this.completeGeneration();
      }

    } catch (error) {
      console.error('Error loading chunk:', error);
      this.currentStatus = `Error loading chunk (${chunkInfo.chunkX}, ${chunkInfo.chunkY}): ${error.message}`;
      this.updateProgress();
    } finally {
      this.activeRequests--;
      
      // Continue processing queue if not paused
      if (!this.isPaused) {
        setTimeout(() => this.processLoadingQueue(), 10);
      }
    }
  }

  renderChunk(chunkData, chunkInfo) {
    if (!this.mapContext) return;

    const { tiles } = chunkData;
    const startX = chunkInfo.localX * this.CHUNK_SIZE * this.TILE_SIZE;
    const startY = chunkInfo.localY * this.CHUNK_SIZE * this.TILE_SIZE;

    // Render each tile in the chunk
    tiles.forEach((row, y) => {
      row.forEach((compactTile, x) => {
        const tile = this.compactToTile(compactTile, x, y);
        const color = this.getTileColor(tile);
        
        this.mapContext.fillStyle = color;
        this.mapContext.fillRect(
          startX + x * this.TILE_SIZE,
          startY + y * this.TILE_SIZE,
          this.TILE_SIZE,
          this.TILE_SIZE
        );
      });
    });
  }

  compactToTile(compactTile, x, y) {
    return {
      type: compactTile.t === 0 ? 'ocean' : 'land',
      x,
      y,
      elevation: compactTile.e / 255,
      temperature: compactTile.tmp / 255,
      moisture: compactTile.m / 255,
      biome: this.BIOME_TYPES[compactTile.b] || 'grassland'
    };
  }

  getTileColor(tile) {
    const baseColor = this.BIOME_COLORS[tile.biome] || '#888888';
    
    // Apply elevation-based darkening
    const darkeningFactor = 1 - (tile.elevation * 0.4);
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    
    const shadedR = Math.floor(r * darkeningFactor);
    const shadedG = Math.floor(g * darkeningFactor);
    const shadedB = Math.floor(b * darkeningFactor);
    
    return '#' + [shadedR, shadedG, shadedB]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  }

  completeGeneration() {
    this.isGenerating = false;
    this.isPaused = false;
    this.currentStatus = `World generation complete! Generated ${this.totalChunks} chunks.`;
    this.updateProgress();
    this.updateUI();
    
    // Show completion message briefly
    setTimeout(() => {
      if (!this.isGenerating) {
        this.currentStatus = 'Ready to generate new world';
        this.updateProgress();
      }
    }, 3000);
  }
}

// Initialize the chunk map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChunkWorldMap();
});