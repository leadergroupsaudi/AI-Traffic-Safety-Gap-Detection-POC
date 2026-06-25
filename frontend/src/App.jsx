import React, { useState, useEffect } from 'react'
import Header        from './components/Header.jsx'
import StatCards     from './components/StatCards.jsx'
import RulesMatrix   from './components/RulesMatrix.jsx'
import Footer        from './components/Footer.jsx'
import UploadPage    from './pages/UploadPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import FindingsPage  from './pages/FindingsPage.jsx'
import './App.css'

export default function App() {
  const [activeTab,     setActiveTab]     = useState('upload')
  const [roleState,     setRoleState]     = useState('public')
  const [zoneFocus,     setZoneFocus]     = useState('St. Jude Trauma Center')
  // Rules stored per-hospital: { [zone]: { rules: [], totalFindings: 0 } }
  const [zoneRulesMap,  setZoneRulesMap]  = useState({})
  const [hasScanned,    setHasScanned]    = useState(() => {
    try { return localStorage.getItem('hasScanned') === 'true' } catch { return false }
  })
  const [archivedClips, setArchivedClips] = useState(() => {
    try {
      const saved = localStorage.getItem('archivedClips')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try { localStorage.setItem('archivedClips', JSON.stringify(archivedClips)) } catch {}
  }, [archivedClips])

  useEffect(() => {
    try { localStorage.setItem('hasScanned', hasScanned ? 'true' : 'false') } catch {}
  }, [hasScanned])

  // Fetch rules for the current zone if not yet loaded (or on first scan)
  useEffect(() => {
    fetch(`/api/rules?zone=${encodeURIComponent(zoneFocus)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setZoneRulesMap(prev => ({
          ...prev,
          [zoneFocus]: {
            rules:         data.rules         || [],
            totalFindings: data.total_findings || 0,
          },
        }))
      })
      .catch(() => {})
  }, [zoneFocus, hasScanned])

  // Derive current zone's rules
  const currentZoneData = zoneRulesMap[zoneFocus] || { rules: [], totalFindings: 0 }
  const rules           = currentZoneData.rules
  const totalFindings   = currentZoneData.totalFindings

  // Zone-scoped rule setter — mutations stay isolated per hospital
  const setRules = (updater) => {
    setZoneRulesMap(prev => {
      const existing = prev[zoneFocus] || { rules: [], totalFindings: 0 }
      const nextRules = typeof updater === 'function' ? updater(existing.rules) : updater
      return { ...prev, [zoneFocus]: { ...existing, rules: nextRules } }
    })
  }

  const activeRules         = rules.filter(r => r.enabled)
  const appliedRulesets     = activeRules.length
  const rulesWithDetections = activeRules.filter(r => r.detections > 0).length
  const stableRules         = activeRules.filter(r => r.detections === 0).length

  const renderPage = () => {
    switch (activeTab) {
      case 'upload':
        return (
          <UploadPage
            archivedClips={archivedClips}
            setArchivedClips={setArchivedClips}
            setActiveTab={setActiveTab}
            onScanComplete={() => setHasScanned(true)}
          />
        )
      case 'dashboard':
        return <DashboardPage zoneFocus={zoneFocus} hasScanned={hasScanned} setActiveTab={setActiveTab} />

      case 'findings':
        return <FindingsPage hasScanned={hasScanned} setActiveTab={setActiveTab} zoneFocus={zoneFocus} />

      case 'rules':
        return (
          <>
            {hasScanned && (
              <StatCards
                applied={appliedRulesets}
                violations={rulesWithDetections}
                stable={stableRules}
              />
            )}
            <RulesMatrix rules={rules} setRules={setRules} totalFindings={totalFindings} roleState={roleState} zoneFocus={zoneFocus} />
          </>
        )

      default:
        return (
          <div className="placeholder-page">
            <div className="placeholder-inner">
              <span className="placeholder-icon">🚧</span>
              <h2>Coming Soon</h2>
              <p>The <strong>{activeTab}</strong> module is under development.</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        roleState={roleState}
        setRoleState={setRoleState}
        zoneFocus={zoneFocus}
        setZoneFocus={setZoneFocus}
      />

      <main className="page-main">
        {renderPage()}
      </main>

      <Footer />
    </div>
  )
}

/* ── Shared gate placeholder ──────────────────────── */
function ScanGate({ setActiveTab }) {
  return (
    <div className="scan-gate">
      <div className="scan-gate-icon-wrap">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round">
          <path d="M12 2a5 5 0 0 1 5 5v1a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8V7a5 5 0 0 1 5-5z" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="9"  y1="14" x2="15" y2="14" />
        </svg>
      </div>
      <h2 className="scan-gate-title">No Inspection Data Available</h2>
      <p className="scan-gate-sub">
        Upload a traffic video and run the AI scan to populate this page with real inspection findings.
      </p>
      <button className="scan-gate-btn" onClick={() => setActiveTab('upload')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
        Go to AI Stream Upload
      </button>
    </div>
  )
}
