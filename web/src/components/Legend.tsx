import React, { useState, useEffect } from 'react'
import './Legend.css'

/**
 * Legend component showing biome colors and information
 */
const Legend: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768 && !isCollapsed) {
        setIsCollapsed(true)
      }
    }

    // Set initial state based on screen size
    setIsCollapsed(window.innerWidth <= 768)

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isCollapsed])

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
  ]

  return (
    <div className="legend">
      <button 
        className="legend-toggle" 
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <span>Legend</span>
        <span>{isCollapsed ? '▶' : '▼'}</span>
      </button>
      <div className={`legend-content ${isCollapsed ? 'collapsed' : ''}`}>
        {biomes.map(biome => (
          <div key={biome.key} className="legend-item">
            <div className={`legend-color ${biome.key}`}></div>
            <span>{biome.label}</span>
          </div>
        ))}
        <div className="legend-note">
          <small>💡 Darker shades indicate higher elevation</small>
        </div>
      </div>
    </div>
  )
}

export default Legend