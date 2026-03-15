import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import './world-generator.ts';
import './app-legend.ts';

type Screen = 'menu' | 'map-generator';

/**
 * Main application component for LarsWorld
 */
export class AppMain extends LitElement {
  @state() private screen: Screen = 'menu';

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

    /* Main menu styles */
    .main-menu {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      gap: 1.5rem;
    }

    .menu-button {
      width: 260px;
      padding: 1rem 2rem;
      font-size: 1.2rem;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .menu-button:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.3);
    }

    .menu-button:not(:disabled):active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .menu-button.primary {
      background: white;
      color: #764ba2;
    }

    .menu-button:disabled {
      background: rgba(255, 255, 255, 0.3);
      color: rgba(255, 255, 255, 0.5);
      cursor: not-allowed;
      box-shadow: none;
    }

    /* Back button */
    .back-button {
      background: none;
      border: 2px solid rgba(255,255,255,0.6);
      color: white;
      padding: 0.4rem 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      cursor: pointer;
      margin: 1rem 0 0 1.5rem;
      transition: background 0.1s ease;
    }

    .back-button:hover {
      background: rgba(255,255,255,0.15);
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

  private _goToMapGenerator() {
    this.screen = 'map-generator';
  }

  private _goToMenu() {
    this.screen = 'menu';
  }

  render() {
    return html`
      <div class="container">
        <h1>LarsWorld</h1>
        ${this.screen === 'menu' ? this._renderMenu() : this._renderMapGenerator()}
      </div>
    `;
  }

  private _renderMenu() {
    return html`
      <p class="subtitle">What would you like to do?</p>
      <div class="main-menu">
        <button class="menu-button primary" @click=${this._goToMapGenerator}>
          Map Generator
        </button>
        <button class="menu-button" disabled>
          New Game (coming soon)
        </button>
      </div>
    `;
  }

  private _renderMapGenerator() {
    return html`
      <button class="back-button" @click=${this._goToMenu}>← Back to menu</button>
      <p class="subtitle">Chunk-Based World Generator</p>
      <world-generator></world-generator>
      <app-legend></app-legend>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-main': AppMain;
  }
}

customElements.define('app-main', AppMain);
