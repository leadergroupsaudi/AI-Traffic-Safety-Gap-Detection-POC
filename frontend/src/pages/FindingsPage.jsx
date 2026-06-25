import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import './FindingsPage.css'

/* ─── Label / colour maps ─────────────────────────── */
const CLASS_LABELS = {
  street_light:       'Street Lights',
  manholes:           'Manhole Covers',
  emergency_sign:     'Emergency Sign',
  ambulance_entrance: 'Ambulance Entrance',
}

const CLASS_COLORS = {
  street_light:       '#f59e0b',
  manholes:           '#8b5cf6',
  emergency_sign:     '#ef4444',
  ambulance_entrance: '#3b82f6',
}

const STATUS_OPTIONS = [
  { value: 'all',            label: 'All Status States' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'CONFIRMED',      label: 'Confirmed' },
  { value: 'REJECTED',       label: 'Rejected' },
]

const RISK_OPTIONS = [
  { value: 'all',    label: 'All Risk Factors' },
  { value: 'HIGH',   label: 'High Risk' },
  { value: 'MEDIUM', label: 'Medium Risk' },
  { value: 'LOW',    label: 'Low Risk' },
]

/* ─── Pure helpers ────────────────────────────────── */
function classLabel(cls) {
  return CLASS_LABELS[cls] || (cls || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function priorityColor(priority) {
  if (priority === 'HIGH')   return '#ef4444'
  if (priority === 'MEDIUM') return '#f59e0b'
  return '#22c55e'
}

function formatTimecode(secs) {
  const s = Math.floor(Number(secs) || 0)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* ─── Sub-components ──────────────────────────────── */
function ScoreBadge({ score, priority }) {
  return (
    <div className="fd-score-badge" style={{ background: priorityColor(priority) }}>
      {score}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'CONFIRMED')      return <span className="fd-status fd-status--critical">CONFIRMED</span>
  if (status === 'PENDING_REVIEW') return <span className="fd-status fd-status--investigating">PENDING REVIEW</span>
  if (status === 'REJECTED')       return <span className="fd-status fd-status--remediated">REJECTED</span>
  if (status === 'EDITED')         return <span className="fd-status fd-status--edited">EDITED</span>
  return null
}

function IrapStars({ rating }) {
  return (
    <div className="fd-irap-stars">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= rating ? 'fd-star-on' : 'fd-star-off'}>★</span>
      ))}
    </div>
  )
}

function FdDropdown({ value, options, onChange, icon }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = options.find(o => o.value === value) || options[0]

  return (
    <div className="fd-dd-wrap" ref={ref}>
      <button className={`fd-dd-btn${open ? ' fd-dd-btn--open' : ''}`} onClick={() => setOpen(o => !o)}>
        {icon && <span className="fd-dd-icon">{icon}</span>}
        <span className="fd-dd-label">{selected?.label}</span>
        <ChevDownSvg />
      </button>
      {open && (
        <div className="fd-dd-menu">
          {options.map(opt => (
            <button
              key={opt.value}
              className={`fd-dd-opt${opt.value === value ? ' fd-dd-opt--active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.value === value && <span className="fd-dd-dot" />}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Loading / Error ─────────────────────────────── */
function FdScanGate({ setActiveTab }) {
  return (
    <div className="fd-status-full">
      <div className="scan-gate-icon-wrap">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round">
          <path d="M12 2a5 5 0 0 1 5 5v1a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8V7a5 5 0 0 1 5-5z" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="9"  y1="14" x2="15" y2="14" />
        </svg>
      </div>
      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>No Inspection Data Available</p>
      <p style={{ margin: 0 }}>Upload a traffic video and run the AI scan to populate findings.</p>
      <button onClick={() => setActiveTab('upload')}
        style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
                 background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 9,
                 padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Go to AI Stream Upload
      </button>
    </div>
  )
}

function FdLoading() {
  return (
    <div className="fd-status-full">
      <div className="fd-spinner" />
      <p>Loading findings from AI pipeline…</p>
    </div>
  )
}

function FdApiError() {
  return (
    <div className="fd-status-full">
      <div style={{ fontSize: 32 }}>⚠</div>
      <p>Backend offline — could not reach <code>/api/findings</code></p>
    </div>
  )
}

/* ─── Main page ───────────────────────────────────── */
export default function FindingsPage({ hasScanned, setActiveTab, zoneFocus }) {
  const [findings,       setFindings]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [apiError,       setApiError]       = useState(false)
  const [selectedId,     setSelectedId]     = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [riskFilter,     setRiskFilter]     = useState('all')
  const [searchQuery,    setSearchQuery]    = useState('')

  /* ── Reset filters when zone changes ──────────── */
  useEffect(() => {
    setCategoryFilter('all')
    setStatusFilter('all')
    setRiskFilter('all')
    setSearchQuery('')
    setSelectedId(null)
  }, [zoneFocus])

  /* ── Fetch ─────────────────────────────────────── */
  useEffect(() => {
    if (!hasScanned) return
    fetch(`/api/findings?zone=${encodeURIComponent(zoneFocus)}`)
      .then(r => { if (!r.ok) throw r; return r.json() })
      .then(data => {
        const arr = Array.isArray(data) ? data : []
        setFindings(arr)
        if (arr.length > 0) setSelectedId(arr[0].finding_id)
        setLoading(false)
      })
      .catch(() => { setApiError(true); setLoading(false) })
  }, [hasScanned, zoneFocus])

  /* ── Category options (derived from real data) ── */
  const categoryOptions = useMemo(() => {
    const classes = [...new Set(findings.map(f => f.trigger_class).filter(Boolean))].sort()
    return [
      { value: 'all', label: 'All Safety Categories' },
      ...classes.map(cls => ({ value: cls, label: classLabel(cls) })),
    ]
  }, [findings])

  /* ── Filtered list ─────────────────────────────── */
  const filtered = useMemo(() => findings.filter(f => {
    if (categoryFilter !== 'all' && f.trigger_class !== categoryFilter) return false
    if (statusFilter   !== 'all' && f.status !== statusFilter)          return false
    if (riskFilter     !== 'all' && f.risk_priority !== riskFilter)     return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!(f.rule_name || '').toLowerCase().includes(q) &&
          !(f.trigger_class || '').toLowerCase().includes(q)) return false
    }
    return true
  }), [findings, categoryFilter, statusFilter, riskFilter, searchQuery])

  /* ── Auto-select first item when filter changes ── */
  useEffect(() => {
    if (filtered.length > 0) setSelectedId(filtered[0].finding_id)
  }, [categoryFilter, statusFilter, riskFilter, searchQuery])

  /* ── Status update ─────────────────────────────── */
  const updateStatus = useCallback(async (findingId, newStatus) => {
    try {
      const res = await fetch(`/api/findings/${findingId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setFindings(prev =>
          prev.map(f => f.finding_id === findingId ? { ...f, status: newStatus } : f)
        )
      }
    } catch { /* silent */ }
  }, [])

  const selected = findings.find(f => f.finding_id === selectedId) || filtered[0] || null

  if (!hasScanned) return <FdScanGate setActiveTab={setActiveTab} />
  if (loading)     return <FdLoading />
  if (apiError)    return <FdApiError />

  return (
    <div className="findings-page">
      {/* ── Toolbar ─────────────────────────────── */}
      <div className="findings-toolbar">
        <div className="fd-search-wrap">
          <SearchSvg />
          <input
            className="fd-search"
            placeholder="Search safety flaws by description or defect class…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="fd-filters">
          <FilterSvg />
          <FdDropdown
            value={categoryFilter}
            options={categoryOptions}
            onChange={setCategoryFilter}
            icon={<GreenDot />}
          />
          <FdDropdown
            value={riskFilter}
            options={RISK_OPTIONS}
            onChange={setRiskFilter}
            icon={<RiskDot risk={riskFilter} />}
          />
          <FdDropdown
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
            icon={<TagSvg />}
          />
        </div>
      </div>

      {/* ── Split layout ─────────────────────────── */}
      <div className="findings-split">
        {/* Left — incident list */}
        <div className="fd-list-panel">
          <div className="fd-list-header">
            <span className="fd-list-title">LOGGED INCIDENTS ({filtered.length})</span>
            <span className="fd-list-hint">Select card to view detail</span>
          </div>
          <div className="fd-cards-scroll">
            {filtered.length === 0 ? (
              <div className="fd-no-results">No findings match the current filters.</div>
            ) : filtered.map(f => (
              <button
                key={f.finding_id}
                className={`fd-card${selectedId === f.finding_id ? ' fd-card--active' : ''}`}
                onClick={() => setSelectedId(f.finding_id)}
              >
                <ScoreBadge score={f.risk_score} priority={f.risk_priority} />
                <div className="fd-card-body">
                  <div className="fd-card-meta">
                    <span className="fd-card-cat" style={{ color: CLASS_COLORS[f.trigger_class] || '#94a3b8' }}>
                      {classLabel(f.trigger_class).toUpperCase()}
                    </span>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="fd-card-title">{f.rule_name}</div>
                  <div className="fd-card-loc">
                    <LocSvg />
                    <span>~{Math.round(Number(f.position_start_meters) || 0)}m · {f.rule_id}</span>
                  </div>
                </div>
                <span className="fd-card-chevron"><ChevRightSvg /></span>
              </button>
            ))}
          </div>
        </div>

        {/* Right — detail panel */}
        <div className="fd-detail-panel">
          {selected ? (
            <FindingDetail
              finding={selected}
              onStatusChange={updateStatus}
            />
          ) : (
            <div className="fd-empty">
              <CctvSvg />
              <p>Select an incident from the list to view its full detail.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Detail panel ────────────────────────────────── */
function FindingDetail({ finding, onStatusChange }) {
  const [imgOk, setImgOk] = useState(true)

  // Reset image state when finding changes
  useEffect(() => setImgOk(true), [finding.finding_id])

  const catColor    = CLASS_COLORS[finding.trigger_class] || '#94a3b8'
  const timecode    = formatTimecode(finding.gap_start_sec)
  const meters      = Math.round(Number(finding.position_start_meters) || 0)
  const confPct     = finding.trigger_confidence > 0
    ? Math.round(Number(finding.trigger_confidence) * 100)
    : null
  const description = finding.ai_recommendation || finding.recommended_action || '—'
  const mainIssue   = finding.recommended_action || '—'
  const imgUrl      = finding.snapshot_path ? `/${finding.snapshot_path}` : null

  return (
    <div className="fd-detail">
      {/* CCTV capture */}
      <div className="fd-cctv">
        <span className="fd-cctv-badge">AI SCAN CAPTURE</span>
        <span className="fd-cctv-time">Timecode: {timecode}</span>

        {imgUrl && imgOk ? (
          <img
            src={imgUrl}
            alt="CCTV scan capture"
            className="fd-cctv-img"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="fd-cctv-center">
            <CctvBigSvg />
            <span className="fd-cctv-hint">{finding.finding_id} · {classLabel(finding.trigger_class)}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="fd-detail-body">
        <div className="fd-detail-cat" style={{ color: catColor }}>
          {classLabel(finding.trigger_class).toUpperCase()}
        </div>
        <h2 className="fd-detail-title">{finding.rule_name}</h2>

        {/* Metrics row */}
        <div className="fd-metrics">
          <div className="fd-metric">
            <div className="fd-metric-val" style={{ color: priorityColor(finding.risk_priority) }}>
              {finding.risk_score}
            </div>
            <div className="fd-metric-name">RISK SCORE</div>
            <div className="fd-metric-sub">{finding.risk_priority} PRIORITY</div>
          </div>
          <div className="fd-metric fd-metric--bordered">
            <IrapStars rating={Number(finding.irap_stars) || 1} />
            <div className="fd-metric-name">IRAP SAFETY</div>
            <div className="fd-metric-sub">{finding.irap_label || `${finding.irap_stars} STAR RATING`}</div>
          </div>
          <div className="fd-metric">
            <div className="fd-metric-val fd-metric-val--blue">
              {confPct !== null ? `${confPct}%` : '—'}
            </div>
            <div className="fd-metric-name">CONFIDENCE SCORE</div>
          </div>
        </div>

        {/* Defect description */}
        <div className="fd-sec-label">DEFECT DESCRIPTION</div>
        <p className="fd-desc-text">{description}</p>

        {/* Main issue box */}
        <div className="fd-main-issue">
          <div className="fd-main-issue-title">RECOMMENDED ACTION</div>
          <p className="fd-main-issue-text">{mainIssue}</p>
        </div>

        {/* Location + reference */}
        <div className="fd-meta-row">
          <div className="fd-meta-item">
            <LocSvg />
            <div>
              <div className="fd-meta-label">Precise Location</div>
              <div className="fd-meta-val">~{meters}m from inspection origin</div>
            </div>
          </div>
          <div className="fd-meta-item">
            <IdSvg />
            <div>
              <div className="fd-meta-label">Finding Reference</div>
              <div className="fd-meta-val">{finding.finding_id}</div>
            </div>
          </div>
        </div>

        {/* Violated standard */}
        <div className="fd-sec-label">VIOLATED SAFETY STANDARD</div>
        <div className="fd-rules-list">
          <div className="fd-rule-card">
            <RuleSvg />
            <div className="fd-rule-text">
              <div className="fd-rule-title">{finding.rule_id}: {finding.rule_name}</div>
              <div className="fd-rule-desc">{finding.standard}</div>
            </div>
          </div>
        </div>

        {/* Remediation status */}
        <div className="fd-remediation">
          <div className="fd-rem-left">
            <div className="fd-rem-title">Remediation Status State</div>
            <div className="fd-rem-desc">Update the triage state as steps are taken to resolve the flaw.</div>
          </div>
          <div className="fd-rem-btns">
            <button
              className={`fd-rem-btn${finding.status === 'PENDING_REVIEW' ? ' fd-rem-btn--invest-active' : ' fd-rem-btn--inactive'}`}
              onClick={() => onStatusChange(finding.finding_id, 'PENDING_REVIEW')}
            >
              Pending Review
            </button>
            <button
              className={`fd-rem-btn${finding.status === 'CONFIRMED' ? ' fd-rem-btn--critical-active' : ' fd-rem-btn--inactive'}`}
              onClick={() => onStatusChange(finding.finding_id, 'CONFIRMED')}
            >
              Confirmed
            </button>
            <button
              className={`fd-rem-btn${finding.status === 'REJECTED' ? ' fd-rem-btn--remed-active' : ' fd-rem-btn--inactive'}`}
              onClick={() => onStatusChange(finding.finding_id, 'REJECTED')}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── SVG Icons ───────────────────────────────────── */
function SearchSvg() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function FilterSvg() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}
function TagSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}
function GreenDot() {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
}

function RiskDot({ risk }) {
  const color = risk === 'HIGH' ? '#ef4444' : risk === 'MEDIUM' ? '#f59e0b' : risk === 'LOW' ? '#22c55e' : '#3b82f6'
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
}
function ChevDownSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function ChevRightSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
function LocSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
function IdSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )
}
function RuleSvg() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
    </svg>
  )
}
function CctvSvg() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
      <rect x="2" y="7" width="15" height="11" rx="2" />
      <path d="M17 9l5-3v12l-5-3V9z" />
    </svg>
  )
}
function CctvBigSvg() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <rect x="2" y="7" width="15" height="11" rx="2" />
      <path d="M17 9l5-3v12l-5-3V9z" />
      <line x1="6" y1="12" x2="10" y2="12" />
    </svg>
  )
}
