import { LitElement, html, css } from 'lit';

interface CoordinateChangeDetail {
  [key: string]: number;
}

interface WorldNameChangeDetail {
  worldName: string;
}

/**
 * Control panel component for world generation parameters
 */
export class ControlPanel extends LitElement {
  static properties = {
    minX: { type: Number },
    maxX: { type: Number },
    minY: { type: Number },
    maxY: { type: Number },
    worldName: { type: String },
    isGenerating: { type: Boolean },
    isPaused: { type: Boolean },
    canStart: { type: Boolean },
    estimatedSize: { type: String },
    statusMessage: { type: String }
  };

  // TypeScript property declarations
  declare minX: number;
  declare maxX: number;
  declare minY: number;
  declare maxY: number;
  declare worldName: string;
  declare isGenerating: boolean;
  declare isPaused: boolean;
  declare canStart: boolean;
  declare estimatedSize: string;
  declare statusMessage: string;

  static styles = css`
    :host {
      display: block;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }

    .controls-container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }

    .coordinate-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-weight: 600;
      color: #374151;
      font-size: 0.9rem;
    }

    input {
      padding: 0.75rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    input:invalid {
      border-color: #ef4444;
    }

    .world-name-group {
      margin-bottom: 1.5rem;
    }

    .world-name-group input {
      width: 100%;
      box-sizing: border-box;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    button {
      flex: 1;
      padding: 1rem 2rem;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .start-button {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }

    .start-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
    }

    .start-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }

    .pause-button {
      background: #6b7280;
      color: white;
    }

    .pause-button:hover:not(:disabled) {
      background: #4b5563;
    }

    .pause-button:disabled {
      background: #d1d5db;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .info-section {
      padding: 1rem;
      background: #f3f4f6;
      border-radius: 8px;
      font-size: 0.9rem;
      color: #6b7280;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .warning {
      color: #dc2626;
      font-weight: 600;
    }

    .status-message {
      text-align: center;
      font-weight: 600;
      margin-top: 1rem;
      padding: 0.5rem;
      border-radius: 6px;
      background: #dbeafe;
      color: #1e40af;
    }

    @media (max-width: 768px) {
      .controls-container {
        padding: 1.5rem;
      }

      .coordinate-grid {
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .button-group {
        flex-direction: column;
      }
    }
  `;

  constructor() {
    super();
    this.minX = 0;
    this.maxX = 100;
    this.minY = 0;
    this.maxY = 100;
    this.worldName = '';
    this.isGenerating = false;
    this.isPaused = false;
    this.canStart = true;
    this.estimatedSize = '';
    this.statusMessage = '';
    
    // Initial calculation
    this._updateEstimatedSize();
    this._validateCoordinates();
  }

  willUpdate(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('minX') || changedProperties.has('maxX') || 
        changedProperties.has('minY') || changedProperties.has('maxY')) {
      this._updateEstimatedSize();
      this._validateCoordinates();
    }
  }

  private _updateEstimatedSize() {
    const chunkCount = (this.maxX - this.minX + 1) * (this.maxY - this.minY + 1);
    // Each chunk has 256 tiles, each tile has roughly 100 bytes of data (biome, elevation, etc.)
    const estimatedSizeBytes = chunkCount * 16 * 16 * 100; // More realistic estimation
    const estimatedSizeMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(1);
    this.estimatedSize = `${estimatedSizeMB} MB`;
  }

  private _validateCoordinates() {
    // Only validate that coordinates make sense (max >= min)
    this.canStart = this.maxX >= this.minX && this.maxY >= this.minY;
  }

  private _handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const { name, value } = target;
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue)) {
      (this as any)[name] = numValue;
      this.dispatchEvent(new CustomEvent<CoordinateChangeDetail>('coordinate-change', {
        detail: { [name]: numValue }
      }));
    }
  }

  private _handleWorldNameChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.worldName = target.value;
    this.dispatchEvent(new CustomEvent<WorldNameChangeDetail>('world-name-change', {
      detail: { worldName: this.worldName }
    }));
  }

  private _handleStartGeneration() {
    this.dispatchEvent(new CustomEvent('start-generation'));
  }

  private _handlePauseGeneration() {
    this.dispatchEvent(new CustomEvent('pause-generation'));
  }

  render() {
    const chunkCount = (this.maxX - this.minX + 1) * (this.maxY - this.minY + 1);

    return html`
      <div class="controls-container">
        <div class="coordinate-grid">
          <div class="input-group">
            <label for="minX">Min Chunk X</label>
            <input
              type="number"
              id="minX"
              name="minX"
              .value=${this.minX.toString()}
              @input=${this._handleInputChange}
              min="-1000"
              max="1000"
              required
            />
          </div>
          <div class="input-group">
            <label for="maxX">Max Chunk X</label>
            <input
              type="number"
              id="maxX"
              name="maxX"
              .value=${this.maxX.toString()}
              @input=${this._handleInputChange}
              min="-1000"
              max="1000"
              required
            />
          </div>
          <div class="input-group">
            <label for="minY">Min Chunk Y</label>
            <input
              type="number"
              id="minY"
              name="minY"
              .value=${this.minY.toString()}
              @input=${this._handleInputChange}
              min="-1000"
              max="1000"
              required
            />
          </div>
          <div class="input-group">
            <label for="maxY">Max Chunk Y</label>
            <input
              type="number"
              id="maxY"
              name="maxY"
              .value=${this.maxY.toString()}
              @input=${this._handleInputChange}
              min="-1000"
              max="1000"
              required
            />
          </div>
        </div>

        <div class="world-name-group">
          <div class="input-group">
            <label for="worldName">World Name (optional)</label>
            <input
              type="text"
              id="worldName"
              name="worldName"
              .value=${this.worldName}
              @input=${this._handleWorldNameChange}
              placeholder="Leave empty for random seed"
            />
          </div>
        </div>

        <div class="button-group">
          <button
            class="start-button"
            @click=${this._handleStartGeneration}
            ?disabled=${!this.canStart || this.isGenerating}
          >
            ${this.isGenerating && !this.isPaused ? '🌍 Generating...' : '🌍 Start Generation'}
          </button>
          <button
            class="pause-button"
            @click=${this._handlePauseGeneration}
            ?disabled=${!this.isGenerating}
          >
            ${this.isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
        </div>

        <div class="info-section">
          <div class="info-row">
            <span>Chunks:</span>
            <span>${chunkCount} chunks (${chunkCount * 16 * 16} tiles)</span>
          </div>
          <div class="info-row">
            <span>Area:</span>
            <span>${(this.maxX - this.minX + 1) * 16} × ${(this.maxY - this.minY + 1) * 16} tiles</span>
          </div>
        </div>

        ${this.statusMessage ? html`
          <div class="status-message">${this.statusMessage}</div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'control-panel': ControlPanel;
  }
}

customElements.define('control-panel', ControlPanel);