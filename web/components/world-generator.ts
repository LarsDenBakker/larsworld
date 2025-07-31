import { LitElement, html, css } from 'lit';
import './control-panel.ts';
import './world-map.ts';

interface ChunkCoordinate {
  x: number;
  y: number;
}

interface ChunkData {
  [key: number]: {
    biome: string;
    elevation: number;
  };
}

interface CoordinateChangeDetail {
  [key: string]: number;
}

interface WorldNameChangeDetail {
  worldName: string;
}

/**
 * Main world generator component that orchestrates chunk generation and rendering
 */
export class WorldGenerator extends LitElement {
  static properties = {
    isGenerating: { type: Boolean },
    isPaused: { type: Boolean },
    minX: { type: Number },
    maxX: { type: Number },
    minY: { type: Number },
    maxY: { type: Number },
    worldName: { type: String },
    loadedChunks: { type: Number },
    totalChunks: { type: Number },
    statusMessage: { type: String },
    chunks: { type: Object }
  };

  // TypeScript property declarations
  declare isGenerating: boolean;
  declare isPaused: boolean;
  declare minX: number;
  declare maxX: number;
  declare minY: number;
  declare maxY: number;
  declare worldName: string;
  declare loadedChunks: number;
  declare totalChunks: number;
  declare statusMessage: string;
  declare chunks: Map<string, ChunkData>;

  worldMap: any;

  // Private generation state
  private activeRequests = 0;
  private maxParallelRequests = 5;
  private loadingQueue: ChunkCoordinate[] = [];
  private seed = '';
  private batchSize = 200; // Conservative batch size to stay under 6MB

  constructor() {
    super();
    this.isGenerating = false;
    this.isPaused = false;
    this.minX = 0;
    this.maxX = 100;
    this.minY = 0;
    this.maxY = 100;
    this.worldName = '';
    this.loadedChunks = 0;
    this.totalChunks = 0;
    this.statusMessage = '';
    this.chunks = new Map<string, ChunkData>();
  }

  firstUpdated() {
    // Get reference to the world map component
    this.worldMap = this.shadowRoot!.querySelector('world-map');
  }

  private _getWorldMap() {
    if (!this.worldMap) {
      this.worldMap = this.shadowRoot?.querySelector('world-map');
    }
    return this.worldMap;
  }

  static styles = css`
    :host {
      display: block;
    }
  `;

  private _handleCoordinateChange(event: CustomEvent<CoordinateChangeDetail>) {
    const { detail } = event;
    Object.keys(detail).forEach(key => {
      (this as any)[key] = detail[key];
    });
  }

  private _handleWorldNameChange(event: CustomEvent<WorldNameChangeDetail>) {
    this.worldName = event.detail.worldName;
  }

  private async _handleStartGeneration() {
    if (this.isGenerating && this.isPaused) {
      // Resume generation
      this.isPaused = false;
      this.statusMessage = 'Resuming generation...';
      this._processQueue();
      return;
    }

    // Start new generation
    this.isGenerating = true;
    this.isPaused = false;
    this.loadedChunks = 0;
    this.chunks.clear();
    // Trigger reactive update by reassigning the Map
    this.chunks = new Map(this.chunks);
    
    // Generate or use provided seed
    this.seed = this.worldName || this._generateRandomSeed();
    
    // Calculate total chunks and set up queue
    this.totalChunks = (this.maxX - this.minX + 1) * (this.maxY - this.minY + 1);
    this.statusMessage = `Starting generation of ${this.totalChunks} chunks...`;
    
    // Set up the world map canvas
    const worldMap = this._getWorldMap();
    worldMap?.setMapSize(this.minX, this.maxX, this.minY, this.maxY);
    worldMap?.clear();
    
    // Generate diagonal loading queue
    this.loadingQueue = this._generateDiagonalQueue();
    this.activeRequests = 0;
    
    // Start processing
    this._processQueue();
  }

  private _handlePauseGeneration() {
    if (this.isGenerating) {
      this.isPaused = !this.isPaused;
      this.statusMessage = this.isPaused ? 'Generation paused' : 'Resuming generation...';
      
      if (!this.isPaused) {
        this._processQueue();
      }
    }
  }

  private _generateRandomSeed(): string {
    return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  private _generateDiagonalQueue(): ChunkCoordinate[] {
    const queue: ChunkCoordinate[] = [];
    const widthChunks = this.maxX - this.minX + 1;
    const heightChunks = this.maxY - this.minY + 1;
    const maxDiagonal = widthChunks + heightChunks - 2;

    for (let d = 0; d <= maxDiagonal; d++) {
      for (let x = 0; x < widthChunks; x++) {
        const y = d - x;
        if (y >= 0 && y < heightChunks) {
          queue.push({
            x: this.minX + x,
            y: this.minY + y
          });
        }
      }
    }

    return queue;
  }

  private async _processQueue() {
    while (!this.isPaused && 
           this.loadingQueue.length > 0 && 
           this.activeRequests < this.maxParallelRequests) {
      
      // Create batch of chunks to load (up to batchSize)
      const batchChunks = this.loadingQueue.splice(0, this.batchSize);
      if (batchChunks.length > 0) {
        this._loadChunkBatch(batchChunks);
      }
    }

    // Check if generation is complete
    if (this.loadingQueue.length === 0 && this.activeRequests === 0) {
      this.isGenerating = false;
      this.statusMessage = `Generation complete! Loaded ${this.loadedChunks} chunks.`;
    }
  }

  private async _loadChunkBatch(batchChunks: ChunkCoordinate[]) {
    this.activeRequests++;

    try {
      const response = await fetch('/api/chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chunks: batchChunks.map(c => ({ chunkX: c.x, chunkY: c.y })),
          seed: this.seed
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const batchData = await response.json();
      
      // Process each chunk in the batch
      for (const chunkResponse of batchData.chunks) {
        const { chunkX, chunkY, tiles } = chunkResponse;
        
        // Convert response format to the expected ChunkData format
        const chunkData: ChunkData = {};
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const tileIndex = y * 16 + x;
            const tile = tiles[y][x];
            
            // Convert compact tile format to expected format
            chunkData[tileIndex] = {
              biome: this._getBiomeFromCompactTile(tile),
              elevation: tile.e / 255
            };
          }
        }
        
        // Add chunk to map and render with fade animation
        this.chunks.set(`${chunkX},${chunkY}`, chunkData);
        // Trigger reactive update by reassigning the Map
        this.chunks = new Map(this.chunks);
        const worldMap = this._getWorldMap();
        worldMap?.addChunk(chunkX, chunkY, chunkData, this.minX, this.minY);
        
        this.loadedChunks++;
      }
      
      this.statusMessage = `Loaded ${this.loadedChunks}/${this.totalChunks} chunks (batch of ${batchData.chunks.length})`;

    } catch (error) {
      console.error(`Failed to load chunk batch:`, error);
      this.statusMessage = `Error loading chunk batch: ${(error as Error).message}`;
    } finally {
      this.activeRequests--;
      
      // Continue processing queue if not paused
      if (!this.isPaused) {
        this._processQueue();
      }
    }
  }

  private _getBiomeFromCompactTile(tile: any): string {
    // Map biome indices to biome names based on BIOME_TYPES from shared/types.ts
    const biomes = [
      'deep_ocean', 'shallow_ocean', 'desert', 'tundra', 'arctic', 'swamp',
      'grassland', 'forest', 'taiga', 'savanna', 'tropical_forest', 'alpine'
    ];
    return biomes[tile.b] || 'grassland';
  }

  render() {
    return html`
      <control-panel
        .minX=${this.minX}
        .maxX=${this.maxX}
        .minY=${this.minY}
        .maxY=${this.maxY}
        .worldName=${this.worldName}
        .isGenerating=${this.isGenerating}
        .isPaused=${this.isPaused}
        .statusMessage=${this.statusMessage}
        @coordinate-change=${this._handleCoordinateChange}
        @world-name-change=${this._handleWorldNameChange}
        @start-generation=${this._handleStartGeneration}
        @pause-generation=${this._handlePauseGeneration}
      ></control-panel>
      
      <world-map
        .chunks=${this.chunks}
        .isGenerating=${this.isGenerating}
      ></world-map>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'world-generator': WorldGenerator;
  }
}

customElements.define('world-generator', WorldGenerator);