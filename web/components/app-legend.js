import { LitElement, html, css } from 'lit';

/**
 * Legend component showing biome colors and information
 */
export class AppLegend extends LitElement {
  static properties = {
    isCollapsed: { type: Boolean }
  };

  static styles = css`
    :host {
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 1rem;
      max-width: 200px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      z-index: 1000;
      transition: transform 0.3s ease;
    }

    .legend-toggle {
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      padding: 0.5rem 0;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .legend-content {
      max-height: 400px;
      overflow-y: auto;
      transition: max-height 0.3s ease;
    }

    .legend-content.collapsed {
      max-height: 0;
      overflow: hidden;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }

    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      border: 1px solid rgba(0,0,0,0.1);
    }

    .legend-note {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #e5e7eb;
      font-size: 0.75rem;
      color: #6b7280;
    }

    /* Biome colors */
    .deep-ocean { background-color: #4169e1; }
    .shallow-ocean { background-color: #6496e6; }
    .desert { background-color: #eecbad; }
    .tundra { background-color: #b0c4de; }
    .arctic { background-color: #f8f8ff; }
    .swamp { background-color: #556b2f; }
    .grassland { background-color: #7cfc00; }
    .forest { background-color: #228b22; }
    .taiga { background-color: #487648; }
    .savanna { background-color: #bdb76b; }
    .tropical-forest { background-color: #006400; }
    .alpine { background-color: #a9a9a9; }

    @media (max-width: 768px) {
      :host {
        top: auto;
        bottom: 1rem;
        right: 1rem;
        left: 1rem;
        max-width: none;
      }

      .legend-content.collapsed {
        display: none;
      }
    }
  `;

  constructor() {
    super();
    this.isCollapsed = window.innerWidth <= 768;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', this._handleResize.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._handleResize.bind(this));
  }

  _handleResize() {
    if (window.innerWidth <= 768 && !this.isCollapsed) {
      this.isCollapsed = true;
    }
  }

  _toggleLegend() {
    this.isCollapsed = !this.isCollapsed;
  }

  render() {
    const biomes = [
      { key: 'deep-ocean', label: 'Deep Ocean' },
      { key: 'shallow-ocean', label: 'Shallow Ocean' },
      { key: 'arctic', label: 'Arctic' },
      { key: 'tundra', label: 'Tundra' },
      { key: 'taiga', label: 'Taiga' },
      { key: 'forest', label: 'Forest' },
      { key: 'grassland', label: 'Grassland' },
      { key: 'savanna', label: 'Savanna' },
      { key: 'desert', label: 'Desert' },
      { key: 'tropical-forest', label: 'Tropical Forest' },
      { key: 'swamp', label: 'Swamp' },
      { key: 'alpine', label: 'Alpine' }
    ];

    return html`
      <button class="legend-toggle" @click=${this._toggleLegend} aria-expanded=${!this.isCollapsed}>
        <span>Legend</span>
        <span>${this.isCollapsed ? '▶' : '▼'}</span>
      </button>
      <div class="legend-content ${this.isCollapsed ? 'collapsed' : ''}">
        ${biomes.map(biome => html`
          <div class="legend-item">
            <div class="legend-color ${biome.key}"></div>
            <span>${biome.label}</span>
          </div>
        `)}
        <div class="legend-note">
          <small>💡 Darker shades indicate higher elevation</small>
        </div>
      </div>
    `;
  }
}

customElements.define('app-legend', AppLegend);