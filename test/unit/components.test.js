import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing';
import '../../../web/components/app-main.ts';
import '../../../web/components/app-legend.ts';
import '../../../web/components/control-panel.ts';

describe('LarsWorld Components', () => {
  describe('AppMain', () => {
    it('should render the main application', async () => {
      const el = await fixture(html`<app-main></app-main>`);
      expect(el).to.exist;
      
      const title = el.shadowRoot.querySelector('h1');
      expect(title.textContent).to.equal('LarsWorld');
      
      const subtitle = el.shadowRoot.querySelector('.subtitle');
      expect(subtitle.textContent).to.equal('Chunk-Based World Generator');
    });

    it('should contain world-generator and app-legend components', async () => {
      const el = await fixture(html`<app-main></app-main>`);
      
      const worldGenerator = el.shadowRoot.querySelector('world-generator');
      const legend = el.shadowRoot.querySelector('app-legend');
      
      expect(worldGenerator).to.exist;
      expect(legend).to.exist;
    });
  });

  describe('AppLegend', () => {
    it('should render legend with toggle button', async () => {
      const el = await fixture(html`<app-legend></app-legend>`);
      
      const toggle = el.shadowRoot.querySelector('.legend-toggle');
      expect(toggle).to.exist;
      expect(toggle.textContent).to.include('Legend');
    });

    it('should toggle legend content when clicked', async () => {
      const el = await fixture(html`<app-legend></app-legend>`);
      
      const toggle = el.shadowRoot.querySelector('.legend-toggle');
      const content = el.shadowRoot.querySelector('.legend-content');
      
      // Initially should not be collapsed (on desktop)
      expect(el.isCollapsed).to.be.false;
      expect(content.classList.contains('collapsed')).to.be.false;
      
      // Click toggle
      toggle.click();
      await el.updateComplete;
      
      expect(el.isCollapsed).to.be.true;
      expect(content.classList.contains('collapsed')).to.be.true;
    });

    it('should render all biome legend items', async () => {
      const el = await fixture(html`<app-legend></app-legend>`);
      
      const legendItems = el.shadowRoot.querySelectorAll('.legend-item');
      expect(legendItems.length).to.equal(12); // 12 different biomes
      
      // Check for specific biomes
      const itemTexts = Array.from(legendItems).map(item => item.textContent.trim());
      expect(itemTexts).to.include('Deep Ocean');
      expect(itemTexts).to.include('Forest');
      expect(itemTexts).to.include('Desert');
    });
  });

  describe('ControlPanel', () => {
    it('should render coordinate inputs', async () => {
      const el = await fixture(html`<control-panel></control-panel>`);
      
      const minXInput = el.shadowRoot.querySelector('input[name="minX"]');
      const maxXInput = el.shadowRoot.querySelector('input[name="maxX"]');
      const minYInput = el.shadowRoot.querySelector('input[name="minY"]');
      const maxYInput = el.shadowRoot.querySelector('input[name="maxY"]');
      
      expect(minXInput).to.exist;
      expect(maxXInput).to.exist;
      expect(minYInput).to.exist;
      expect(maxYInput).to.exist;
    });

    it('should have default coordinate values', async () => {
      const el = await fixture(html`<control-panel></control-panel>`);
      
      expect(el.minX).to.equal(0);
      expect(el.maxX).to.equal(100);
      expect(el.minY).to.equal(0);
      expect(el.maxY).to.equal(100);
    });

    it('should emit coordinate-change event when inputs change', async () => {
      const el = await fixture(html`<control-panel></control-panel>`);
      
      let eventDetails = null;
      el.addEventListener('coordinate-change', (e) => {
        eventDetails = e.detail;
      });
      
      const minXInput = el.shadowRoot.querySelector('input[name="minX"]');
      minXInput.value = '5';
      minXInput.dispatchEvent(new Event('input'));
      
      expect(eventDetails).to.deep.equal({ minX: 5 });
    });

    it('should render start and pause buttons', async () => {
      const el = await fixture(html`<control-panel></control-panel>`);
      
      const startButton = el.shadowRoot.querySelector('.start-button');
      const pauseButton = el.shadowRoot.querySelector('.pause-button');
      
      expect(startButton).to.exist;
      expect(pauseButton).to.exist;
      expect(startButton.textContent).to.include('Start Generation');
    });

    it('should calculate estimated size correctly', async () => {
      const el = await fixture(html`<control-panel></control-panel>`);
      
      // Default 101x101 grid should show estimated size
      const infoSection = el.shadowRoot.querySelector('.info-section');
      expect(infoSection.textContent).to.include('10201 chunks');
      expect(infoSection.textContent).to.include('tiles');
    });

    it('should validate coordinates and disable start for invalid ranges', async () => {
      const el = await fixture(html`<control-panel></control-panel>`);
      
      // Initially should be able to start with valid default area
      expect(el.canStart).to.be.true;
      
      // Set invalid range where max < min
      el.minX = 5;
      el.maxX = 2; // Invalid: max < min
      el.minY = 0;
      el.maxY = 2;
      
      // Force update and wait for completion
      el.requestUpdate();
      await el.updateComplete;
      
      // Should now be disabled due to invalid coordinate range
      expect(el.canStart).to.be.false;
      
      // Check that start button is disabled
      const startButton = el.shadowRoot.querySelector('.start-button');
      expect(startButton.disabled).to.be.true;
    });
  });
});