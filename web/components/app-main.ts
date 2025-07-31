import { LitElement, html, css } from 'lit';
import './world-generator.ts';
import './app-legend.ts';

/**
 * Main application component for LarsWorld
 */
export class AppMain extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    }

    .container {
      position: relative;
      min-height: 100vh;
    }

    h1 {
      text-align: center;
      color: white;
      font-size: 3rem;
      font-weight: 700;
      margin: 0;
      padding: 2rem 0 1rem 0;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .subtitle {
      text-align: center;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1.2rem;
      margin: 0 0 2rem 0;
      font-weight: 300;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 2rem;
        padding: 1rem 0 0.5rem 0;
      }
      
      .subtitle {
        font-size: 1rem;
        margin: 0 0 1rem 0;
      }
    }
  `;

  render() {
    return html`
      <div class="container">
        <h1>LarsWorld</h1>
        <p class="subtitle">Chunk-Based World Generator</p>
        
        <world-generator></world-generator>
        <app-legend></app-legend>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-main': AppMain;
  }
}

customElements.define('app-main', AppMain);