import React from 'react'
import WorldGenerator from './WorldGenerator'
import Legend from './Legend'
import './App.css'

/**
 * Main application component for LarsWorld
 */
const App: React.FC = () => {
  return (
    <div className="app-container">
      <h1>LarsWorld</h1>
      <p className="subtitle">Chunk-Based World Generator</p>
      
      <WorldGenerator />
      <Legend />
    </div>
  )
}

export default App