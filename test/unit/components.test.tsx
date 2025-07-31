import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../web/src/components/App'
import Legend from '../../web/src/components/Legend'
import ControlPanel from '../../web/src/components/ControlPanel'

// Mock fetch for API calls
global.fetch = vi.fn()

describe('LarsWorld React Components', () => {
  describe('App', () => {
    it('should render the main application', () => {
      render(<App />)
      
      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toHaveTextContent('LarsWorld')
      
      const subtitle = screen.getByText('Chunk-Based World Generator')
      expect(subtitle).toBeInTheDocument()
    })

    it('should contain control panel and legend components', () => {
      render(<App />)
      
      // Check for control panel elements
      expect(screen.getByLabelText('Min Chunk X')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start generation/i })).toBeInTheDocument()
      
      // Check for legend
      expect(screen.getByRole('button', { name: /legend/i })).toBeInTheDocument()
    })
  })

  describe('Legend', () => {
    it('should render legend with toggle button', () => {
      render(<Legend />)
      
      const toggle = screen.getByRole('button', { name: /legend/i })
      expect(toggle).toBeInTheDocument()
    })

    it('should render legend with toggle functionality', () => {
      render(<Legend />)
      
      const toggle = screen.getByRole('button', { name: /legend/i })
      expect(toggle).toBeInTheDocument()
      
      // Should show collapsed/expanded state indicator
      expect(toggle.textContent).toMatch(/[▶▼]/)
    })

    it('should render all biome legend items', () => {
      render(<Legend />)
      
      // Check for specific biomes
      expect(screen.getByText('Deep Ocean')).toBeInTheDocument()
      expect(screen.getByText('Forest')).toBeInTheDocument()
      expect(screen.getByText('Desert')).toBeInTheDocument()
      expect(screen.getByText('Tropical Forest')).toBeInTheDocument()
      
      // Count all legend items (12 biomes)
      const legendItems = screen.getAllByText(/Ocean|Desert|Tundra|Arctic|Swamp|Grassland|Forest|Taiga|Savanna|Alpine/)
      expect(legendItems).toHaveLength(12)
    })
  })

  describe('ControlPanel', () => {
    const mockProps = {
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 100,
      worldName: '',
      isGenerating: false,
      isPaused: false,
      statusMessage: '',
      onCoordinateChange: vi.fn(),
      onWorldNameChange: vi.fn(),
      onStartGeneration: vi.fn(),
      onPauseGeneration: vi.fn()
    }

    it('should render coordinate inputs', () => {
      render(<ControlPanel {...mockProps} />)
      
      expect(screen.getByLabelText('Min Chunk X')).toBeInTheDocument()
      expect(screen.getByLabelText('Max Chunk X')).toBeInTheDocument()
      expect(screen.getByLabelText('Min Chunk Y')).toBeInTheDocument()
      expect(screen.getByLabelText('Max Chunk Y')).toBeInTheDocument()
    })

    it('should have default coordinate values', () => {
      render(<ControlPanel {...mockProps} />)
      
      // Check by specific labels to avoid multiple elements with same value
      expect(screen.getByLabelText('Min Chunk X')).toHaveValue(0)
      expect(screen.getByLabelText('Max Chunk X')).toHaveValue(100)
      expect(screen.getByLabelText('Min Chunk Y')).toHaveValue(0)
      expect(screen.getByLabelText('Max Chunk Y')).toHaveValue(100)
    })

    it('should call coordinate change handler when inputs change', async () => {
      const user = userEvent.setup()
      const onCoordinateChange = vi.fn()
      
      render(<ControlPanel {...mockProps} onCoordinateChange={onCoordinateChange} />)
      
      const minXInput = screen.getByLabelText('Min Chunk X')
      await user.clear(minXInput)
      await user.type(minXInput, '5')
      
      expect(onCoordinateChange).toHaveBeenCalledWith({ minX: 5 })
    })

    it('should render start and pause buttons', () => {
      render(<ControlPanel {...mockProps} />)
      
      expect(screen.getByRole('button', { name: /start generation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })

    it('should calculate estimated size correctly', () => {
      render(<ControlPanel {...mockProps} />)
      
      // Default 101x101 grid should show chunk count
      expect(screen.getByText(/10201 chunks/)).toBeInTheDocument()
      // Check for the specific text pattern that includes both chunk and tile counts
      expect(screen.getByText(/10201 chunks \(2611456 tiles\)/)).toBeInTheDocument()
    })

    it('should disable start button for invalid coordinate ranges', () => {
      // Test with invalid range where max < min
      const invalidProps = {
        ...mockProps,
        minX: 5,
        maxX: 2  // Invalid: max < min
      }
      
      render(<ControlPanel {...invalidProps} />)
      
      const startButton = screen.getByRole('button', { name: /start generation/i })
      expect(startButton).toBeDisabled()
    })

    it('should call start generation handler when start button is clicked', async () => {
      const user = userEvent.setup()
      const onStartGeneration = vi.fn()
      
      render(<ControlPanel {...mockProps} onStartGeneration={onStartGeneration} />)
      
      const startButton = screen.getByRole('button', { name: /start generation/i })
      await user.click(startButton)
      
      expect(onStartGeneration).toHaveBeenCalled()
    })

    it('should call pause generation handler when pause button is clicked', async () => {
      const user = userEvent.setup()
      const onPauseGeneration = vi.fn()
      
      const generatingProps = {
        ...mockProps,
        isGenerating: true,
        onPauseGeneration
      }
      
      render(<ControlPanel {...generatingProps} />)
      
      const pauseButton = screen.getByRole('button', { name: /pause/i })
      await user.click(pauseButton)
      
      expect(onPauseGeneration).toHaveBeenCalled()
    })

    it('should display status message when provided', () => {
      const propsWithStatus = {
        ...mockProps,
        statusMessage: 'Loading chunks...'
      }
      
      render(<ControlPanel {...propsWithStatus} />)
      
      expect(screen.getByText('Loading chunks...')).toBeInTheDocument()
    })
  })
})