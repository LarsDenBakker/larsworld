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
    statusMessage: { type: String }
  };

  worldMap: any;

  // Private generation state
  private activeRequests = 0;
  private maxParallelRequests = 5;
  private loadingQueue: ChunkCoordinate[] = [];
  private chunks = new Map<string, ChunkData>();
  private seed = '';

  constructor() {
    super();
    this.isGenerating = false;
    this.isPaused = false;
    this.minX = 0;
    this.maxX = 2;
    this.minY = 0;
    this.maxY = 2;
    this.worldName = '';
    this.loadedChunks = 0;
    this.totalChunks = 0;
    this.statusMessage = '';
  }

  firstUpdated() {
    // Get reference to the world map component
    this.worldMap = this.shadowRoot!.querySelector('world-map');
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
    
    // Generate or use provided seed
    this.seed = this.worldName || this._generateRandomSeed();
    
    // Calculate total chunks and set up queue
    this.totalChunks = (this.maxX - this.minX + 1) * (this.maxY - this.minY + 1);
    this.statusMessage = `Starting generation of ${this.totalChunks} chunks...`;
    
    // Set up the world map canvas
    this.worldMap?.setMapSize(this.minX, this.maxX, this.minY, this.maxY);
    this.worldMap?.clear();
    
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
      
      const chunk = this.loadingQueue.shift();
      if (chunk) {
        this._loadChunk(chunk.x, chunk.y);
      }
    }

    // Check if generation is complete
    if (this.loadingQueue.length === 0 && this.activeRequests === 0) {
      this.isGenerating = false;
      this.statusMessage = `Generation complete! Loaded ${this.loadedChunks} chunks.`;
    }
  }

  private async _loadChunk(chunkX: number, chunkY: number) {
    this.activeRequests++;

    try {
      const response = await fetch('/api/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chunkX,
          chunkY,
          seed: this.seed
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const chunkData: ChunkData = await response.json();
      
      // Add chunk to map and render
      this.chunks.set(`${chunkX},${chunkY}`, chunkData);
      this.worldMap?.addChunk(chunkX, chunkY, chunkData, this.minX, this.minY);
      
      this.loadedChunks++;
      this.statusMessage = `Loaded ${this.loadedChunks}/${this.totalChunks} chunks`;

    } catch (error) {
      console.error(`Failed to load chunk (${chunkX}, ${chunkY}):`, error);
      this.statusMessage = `Error loading chunk (${chunkX}, ${chunkY}): ${(error as Error).message}`;
    } finally {
      this.activeRequests--;
      
      // Continue processing queue if not paused
      if (!this.isPaused) {
        this._processQueue();
      }
    }
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