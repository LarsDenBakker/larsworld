import { LitElement, html, css } from 'lit';

interface ChunkData {
  [key: number]: {
    biome: string;
    elevation: number;
  };
}

type BiomeKey = 'deep_ocean' | 'shallow_ocean' | 'desert' | 'tundra' | 'arctic' | 'swamp' | 
               'grassland' | 'forest' | 'taiga' | 'savanna' | 'tropical_forest' | 'alpine';

/**
 * World map canvas component for rendering chunks
 */
export class WorldMap extends LitElement {
  static properties = {
    chunks: { type: Object },
    isGenerating: { type: Boolean },
    chunkSize: { type: Number },
    tileSize: { type: Number }
  };

  canvas!: HTMLCanvasElement;

  private context: CanvasRenderingContext2D | null = null;

  constructor() {
    super();
    this.chunks = new Map();
    this.isGenerating = false;
    this.chunkSize = 16;
    this.tileSize = 4;
  }

  static styles = css`
    :host {
      display: block;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }

    .map-container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      text-align: center;
    }

    canvas {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      max-width: 100%;
      height: auto;
      background: #f9fafb;
    }

    .map-placeholder {
      width: 100%;
      height: 300px;
      background: #f3f4f6;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 1.1rem;
    }

    .progress-info {
      margin-top: 1rem;
      padding: 1rem;
      background: #f0f9ff;
      border-radius: 8px;
      color: #0369a1;
    }

    @media (max-width: 768px) {
      .map-container {
        padding: 1.5rem;
      }
      
      .map-placeholder {
        height: 200px;
        font-size: 0.9rem;
      }
    }
  `;

  static readonly BIOME_COLORS: Record<BiomeKey, string> = {
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

  firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas')!;
    if (this.canvas) {
      this.context = this.canvas.getContext('2d');
    }
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('chunks') && this.chunks.size > 0) {
      this._renderMap();
    }
  }

  setMapSize(minX: number, maxX: number, minY: number, maxY: number) {
    if (!this.canvas) return;

    const widthChunks = maxX - minX + 1;
    const heightChunks = maxY - minY + 1;
    const totalWidth = widthChunks * this.chunkSize * this.tileSize;
    const totalHeight = heightChunks * this.chunkSize * this.tileSize;

    this.canvas.width = totalWidth;
    this.canvas.height = totalHeight;
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.height = 'auto';

    // Clear canvas
    if (this.context) {
      this.context.fillStyle = '#f3f4f6';
      this.context.fillRect(0, 0, totalWidth, totalHeight);
    }
  }

  addChunk(chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) {
    const chunkKey = `${chunkX},${chunkY}`;
    this.chunks.set(chunkKey, chunkData);
    this._renderChunk(chunkX, chunkY, chunkData, minX, minY);
  }

  private _renderChunk(chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) {
    if (!this.context || !chunkData) return;

    const offsetX = (chunkX - minX) * this.chunkSize * this.tileSize;
    const offsetY = (chunkY - minY) * this.chunkSize * this.tileSize;

    // Add fade-in animation by using globalAlpha
    this.context.save();
    this.context.globalAlpha = 0.1;

    // Gradually increase opacity for smooth fade-in
    let opacity = 0.1;
    const fadeIn = () => {
      if (opacity >= 1) {
        this.context!.restore();
        return;
      }
      
      this.context!.clearRect(offsetX, offsetY, 
                       this.chunkSize * this.tileSize, 
                       this.chunkSize * this.tileSize);
      this.context!.globalAlpha = opacity;
      
      for (let y = 0; y < this.chunkSize; y++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const tileIndex = y * this.chunkSize + x;
          const tile = chunkData[tileIndex];
          
          if (tile && tile.biome) {
            const color = this._getBiomeColor(tile.biome as BiomeKey, tile.elevation);
            this.context!.fillStyle = color;
            this.context!.fillRect(
              offsetX + x * this.tileSize,
              offsetY + y * this.tileSize,
              this.tileSize,
              this.tileSize
            );
          }
        }
      }
      
      opacity += 0.1;
      requestAnimationFrame(fadeIn);
    };
    
    fadeIn();
  }

  private _renderMap() {
    if (!this.context) return;

    this.chunks.forEach((chunkData, chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(',').map(Number);
      // Note: We'd need minX, minY passed in for proper rendering
      // This is a simplified version
      this._renderChunkSimple(chunkX, chunkY, chunkData);
    });
  }

  private _renderChunkSimple(chunkX: number, chunkY: number, chunkData: ChunkData) {
    if (!this.context || !chunkData) return;

    const offsetX = chunkX * this.chunkSize * this.tileSize;
    const offsetY = chunkY * this.chunkSize * this.tileSize;

    for (let y = 0; y < this.chunkSize; y++) {
      for (let x = 0; x < this.chunkSize; x++) {
        const tileIndex = y * this.chunkSize + x;
        const tile = chunkData[tileIndex];
        
        if (tile && tile.biome) {
          const color = this._getBiomeColor(tile.biome as BiomeKey, tile.elevation);
          this.context.fillStyle = color;
          this.context.fillRect(
            offsetX + x * this.tileSize,
            offsetY + y * this.tileSize,
            this.tileSize,
            this.tileSize
          );
        }
      }
    }
  }

  private _getBiomeColor(biome: BiomeKey, elevation = 0): string {
    const baseColor = WorldMap.BIOME_COLORS[biome] || '#cccccc';
    
    // Apply elevation shading (darker = higher elevation)
    if (elevation > 0.5) {
      return this._darkenColor(baseColor, 0.3);
    } else if (elevation > 0.3) {
      return this._darkenColor(baseColor, 0.15);
    }
    
    return baseColor;
  }

  private _darkenColor(color: string, factor: number): string {
    // Simple color darkening
    const hex = color.replace('#', '');
    const r = Math.floor(parseInt(hex.substr(0, 2), 16) * (1 - factor));
    const g = Math.floor(parseInt(hex.substr(2, 2), 16) * (1 - factor));
    const b = Math.floor(parseInt(hex.substr(4, 2), 16) * (1 - factor));
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  clear() {
    this.chunks.clear();
    if (this.context && this.canvas) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.fillStyle = '#f3f4f6';
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render() {
    const hasChunks = this.chunks.size > 0;

    return html`
      <div class="map-container">
        ${hasChunks ? html`
          <canvas></canvas>
        ` : html`
          <div class="map-placeholder">
            ${this.isGenerating ? 
              '🌍 Generating chunks...' : 
              '🗺️ Click "Start Generation" to create a world'
            }
          </div>
        `}
        
        ${this.isGenerating ? html`
          <div class="progress-info">
            Loading chunks... ${this.chunks.size} loaded
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'world-map': WorldMap;
  }
}

customElements.define('world-map', WorldMap);