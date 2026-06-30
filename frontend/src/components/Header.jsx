import React, { useState, useRef, useEffect } from 'react'
import { generateReport } from '../utils/generateReport.js'
import './Header.css'

const NAV_TABS = [
  { id: 'upload',    label: 'AI Stream Upload',          icon: <UploadIcon /> },
  { id: 'dashboard', label: 'Platform Dashboard',        icon: <DashboardIcon /> },
  { id: 'findings',  label: 'Safety Defects & Findings', icon: <WarningIcon /> },
  { id: 'rules',     label: 'Rules Matrix & Gaps',       icon: <RulesIcon /> },
]

const ZONE_OPTIONS = [
  'Al Manei',
  'City General Memorial',
  "Mercy Women & Children's",
]

const CLIENT_MODE = {
  public: 'Public Auditor View',
  admin:  'Full Admin Permissions',
}

export default function Header({ activeTab, setActiveTab, roleState, setRoleState, zoneFocus, setZoneFocus }) {
  const [dropdownOpen,    setDropdownOpen]    = useState(false)
  const [reportGenerating, setReportGenerating] = useState(false)
  const dropRef = useRef(null)

  const handleDownloadReport = async () => {
    if (reportGenerating) return
    setReportGenerating(true)
    try {
      await generateReport(zoneFocus)
    } finally {
      setReportGenerating(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelectZone = (zone) => {
    setZoneFocus(zone)
    setDropdownOpen(false)
  }

  const isAdmin  = roleState === 'admin'
  const isPublic = roleState === 'public'

  return (
    <header className="header">
      {/* ── Top bar ───────────────────────────── */}
      <div className="header-top">
        <div className="logo">
          <div className="logo-icon-wrap"><LogoIcon /></div>
          <div className="logo-text">
            <span className="logo-title">Traffic AI</span>
            <span className="logo-subtitle">ROAD SAFETY SYSTEMS</span>
          </div>
        </div>

        <div className="header-right">
          {/* Download Report button */}
          <button
            className={`btn-download-report${reportGenerating ? ' btn-download-report--loading' : ''}`}
            onClick={handleDownloadReport}
            disabled={reportGenerating}
            title="Download PDF inspection report"
          >
            {reportGenerating ? <SpinnerIcon /> : <DownloadIcon />}
            {reportGenerating ? 'Generating…' : 'Download Report'}
          </button>

          {/* Zone Focus dropdown */}
          <div className="zone-focus-wrap" ref={dropRef}>
            <button
              className={`zone-focus${dropdownOpen ? ' zone-focus--open' : ''}`}
              onClick={() => setDropdownOpen(o => !o)}
            >
              <span className="zone-cam-icon"><CamIcon /></span>
              <span className="zone-label">Hospital:</span>
              <span className="zone-hospital-icon">🏥</span>
              <span className="zone-name">{zoneFocus}</span>
              <span className={`zone-chevron${dropdownOpen ? ' zone-chevron--up' : ''}`}><ChevronDown /></span>
            </button>

            {dropdownOpen && (
              <div className="zone-dropdown">
                {ZONE_OPTIONS.map(zone => (
                  <button
                    key={zone}
                    className={`zone-option${zone === zoneFocus ? ' zone-option--active' : ''}`}
                    onClick={() => handleSelectZone(zone)}
                  >
                    <span>🏥</span>
                    <span>{zone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role state toggle */}
          <div className="role-state">
            <span className="role-label"><UserIcon /> Role State:</span>
            <button
              className={`role-btn role-public${isPublic ? ' role-btn--active-public' : ''}`}
              onClick={() => setRoleState('public')}
            >
              Public
            </button>
            <button
              className={`role-btn role-admin${isAdmin ? ' role-btn--active-admin' : ''}`}
              onClick={() => setRoleState('admin')}
            >
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* ── Nav bar ───────────────────────────── */}
      <nav className="header-nav">
        <div className="nav-tabs">
          {NAV_TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab${activeTab === tab.id ? ' nav-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-status">
          <span>Client Mode: <GearIcon /> <strong>{CLIENT_MODE[roleState]}</strong></span>
        </div>
      </nav>
    </header>
  )
}

/* ── SVG Icons ─────────────────────────────────── */
function LogoIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <rect width="34" height="34" rx="8" fill="#2563eb" />
      <path d="M17 7L8 11.5V22.5L17 27L26 22.5V11.5L17 7Z" stroke="white" strokeWidth="1.6" fill="none" />
      <circle cx="17" cy="17" r="2.5" fill="white" />
      <line x1="17" y1="9"  x2="17" y2="14" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="17" y1="20" x2="17" y2="25" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="10" y1="17" x2="15" y2="17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="19" y1="17" x2="24" y2="17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CamIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="15" height="11" rx="2" />
      <path d="M17 9l5-3v12l-5-3V9z" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ verticalAlign: 'middle', marginRight: 3 }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ verticalAlign: 'middle', marginRight: 3 }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3"   width="7" height="7" rx="1" />
      <rect x="14" y="3"  width="7" height="7" rx="1" />
      <rect x="3" y="14"  width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function RulesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="8" />
      <line x1="12" y1="16" x2="12" y2="22" />
      <line x1="2"  y1="12" x2="8"  y2="12" />
      <line x1="16" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" style={{ flexShrink: 0 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ flexShrink: 0, animation: 'hdr-spin 0.8s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
