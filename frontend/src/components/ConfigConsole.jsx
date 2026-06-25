import React, { useState } from 'react'
import './ConfigConsole.css'

export default function ConfigConsole() {
  const [showSpec, setShowSpec] = useState(false)
  const [specText, setSpecText] = useState('')

  const handleAddSpec = () => {
    if (showSpec && specText.trim()) {
      alert(`Specification standard added:\n"${specText}"`)
      setSpecText('')
    }
    setShowSpec(s => !s)
  }

  return (
    <div className="config-console">
      {/* Panel header */}
      <div className="config-panel-header">
        <ScalesIcon />
        <span className="config-panel-title">CONFIGURATION CONSOLE</span>
      </div>

      {/* Guideline box */}
      <div className="guideline-box">
        <div className="guideline-heading">
          <BulbIcon />
          <span>Standard Operating Guideline:</span>
        </div>

        <p className="guideline-body">
          Rules represent the criteria applied by the AI analysis system when scanning video files.
        </p>
        <p className="guideline-body">
          As an authorized <strong>**Administrator**</strong>, you can hover any rule and click the
          Pencil/Trash icons to update or remove standards, keeping compliance benchmarks dynamically
          updated.
        </p>

        {showSpec && (
          <textarea
            className="spec-input"
            rows={3}
            placeholder="Enter custom specification standard..."
            value={specText}
            onChange={e => setSpecText(e.target.value)}
            autoFocus
          />
        )}

        <button className="btn-add-spec" onClick={handleAddSpec}>
          {showSpec ? '✓ Confirm Specification' : '+ Add Custom Specification Standard'}
        </button>
      </div>
    </div>
  )
}

/* ── Icons ─────────────────────────────────── */
function ScalesIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M3 6l9-3 9 3" />
      <path d="M3 18l9-3 9 3" />
      <path d="M3 6l4 8H-1" />
      <path d="M21 6l4 8H17" />
      <line x1="3" y1="14" x2="7" y2="14" />
      <line x1="17" y1="14" x2="21" y2="14" />
    </svg>
  )
}

function BulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2">
      <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z"
        stroke="#f59e0b" fill="rgba(245,158,11,0.15)" />
    </svg>
  )
}
