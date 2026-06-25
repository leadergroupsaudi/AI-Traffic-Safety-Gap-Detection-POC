import React, { useState, useEffect } from 'react'
import './DashboardPage.css'

/* ─── Trigger class → readable label ─────────────── */
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

/* ─── Helpers ─────────────────────────────────────── */
function getPostureInfo(pct) {
  if (pct >= 90) return { label: 'OPTIMAL',        color: '#22c55e' }
  if (pct >= 75) return { label: 'GOOD STANDING',  color: '#3b82f6' }
  if (pct >= 50) return { label: 'MODERATE RISKS', color: '#f59e0b' }
  return           { label: 'HIGH RISK',         color: '#ef4444' }
}

function classLabel(cls) {
  return CLASS_LABELS[cls] || cls.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/* ─── Donut Chart ─────────────────────────────────── */
function DonutChart({ pct, postureInfo }) {
  const R = 68, C = 2 * Math.PI * R, arc = (pct / 100) * C
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" width="186" height="186">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#1c2a40" strokeWidth="13" />
        <circle cx="100" cy="100" r={R} fill="none"
          stroke={postureInfo.color} strokeWidth="13" strokeLinecap="round"
          strokeDasharray={`${arc} ${C}`} transform="rotate(145 100 100)" />
        <text x="100" y="94" textAnchor="middle"
          fill="white" fontSize="32" fontWeight="700" fontFamily="inherit">{pct}%</text>
        <text x="100" y="115" textAnchor="middle"
          fill={postureInfo.color} fontSize="10" fontWeight="700"
          fontFamily="inherit" letterSpacing="1.2">{postureInfo.label}</text>
      </svg>
    </div>
  )
}

/* ─── Stat Card ───────────────────────────────────── */
function StatCard({ icon, iconBg, iconBorder, category, value, desc }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon-box" style={{ background: iconBg, border: `1px solid ${iconBorder}` }}>
          {icon}
        </div>
        <div className="stat-content">
          <div className="stat-category">{category}</div>
          <div className="stat-value-row">{value}</div>
        </div>
      </div>
      <p className="stat-desc">{desc}</p>
    </div>
  )
}

/* ─── Status Donut Chart ──────────────────────────── */
function StatusDonut({ confirmed, pending, rejected }) {
  const total = confirmed + pending + rejected
  const R = 52, C = 2 * Math.PI * R

  if (total === 0) {
    return (
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        No data
      </div>
    )
  }

  const cArc = (confirmed / total) * C
  const pArc = (pending  / total) * C
  const rArc = (rejected / total) * C
  const pct  = Math.round((confirmed / total) * 100)

  return (
    <svg viewBox="0 0 160 160" width="150" height="150">
      {/* Track */}
      <circle cx="80" cy="80" r={R} fill="none" stroke="#1c2a40" strokeWidth="13" />
      {/* Confirmed — green */}
      {cArc > 0 && (
        <circle cx="80" cy="80" r={R} fill="none" stroke="#22c55e" strokeWidth="13"
          strokeLinecap="butt"
          strokeDasharray={`${cArc} ${C}`}
          strokeDashoffset={0}
          transform="rotate(-90 80 80)" />
      )}
      {/* Pending — amber */}
      {pArc > 0 && (
        <circle cx="80" cy="80" r={R} fill="none" stroke="#f59e0b" strokeWidth="13"
          strokeLinecap="butt"
          strokeDasharray={`${pArc} ${C}`}
          strokeDashoffset={-cArc}
          transform="rotate(-90 80 80)" />
      )}
      {/* Rejected — red */}
      {rArc > 0 && (
        <circle cx="80" cy="80" r={R} fill="none" stroke="#ef4444" strokeWidth="13"
          strokeLinecap="butt"
          strokeDasharray={`${rArc} ${C}`}
          strokeDashoffset={-(cArc + pArc)}
          transform="rotate(-90 80 80)" />
      )}
      {/* Centre label */}
      <text x="80" y="73" textAnchor="middle" fill="white" fontSize="30" fontWeight="800" fontFamily="inherit">{confirmed}</text>
      <text x="80" y="89" textAnchor="middle" fill="#22c55e" fontSize="9.5" fontWeight="700" fontFamily="inherit" letterSpacing="1">CONFIRMED</text>
      <text x="80" y="103" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="inherit">{pct}% of total</text>
    </svg>
  )
}

/* ─── Loading / Error states ──────────────────────── */
function DashScanGate({ setActiveTab }) {
  return (
    <div className="dash-status-page">
      <div className="scan-gate-icon-wrap">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round">
          <path d="M12 2a5 5 0 0 1 5 5v1a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8V7a5 5 0 0 1 5-5z" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="9"  y1="14" x2="15" y2="14" />
        </svg>
      </div>
      <p className="dash-status-text">No Inspection Data Available</p>
      <p className="dash-status-sub">Upload a traffic video and run the AI scan to populate this dashboard.</p>
      <button className="scan-gate-btn" onClick={() => setActiveTab('upload')}
        style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8,
                 background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 9,
                 padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Go to AI Stream Upload
      </button>
    </div>
  )
}

function DashLoading() {
  return (
    <div className="dash-status-page">
      <div className="dash-spinner" />
      <p className="dash-status-text">Fetching live data from AI pipeline…</p>
    </div>
  )
}

function DashError() {
  return (
    <div className="dash-status-page">
      <div className="dash-status-icon">⚠</div>
      <p className="dash-status-text">Backend offline — could not reach <code>/api/stats</code></p>
      <p className="dash-status-sub">Start the FastAPI server: <code>uvicorn api.main:app --reload --port 8000</code></p>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────── */
export default function DashboardPage({ zoneFocus, hasScanned, setActiveTab }) {
  const [apiStats, setApiStats] = useState(null)
  const [findings, setFindings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [apiError, setApiError] = useState(false)

  useEffect(() => {
    if (!hasScanned) return
    setLoading(true)
    setApiError(false)
    Promise.all([
      fetch(`/api/stats?zone=${encodeURIComponent(zoneFocus)}`).then(r => { if (!r.ok) throw r; return r.json() }),
      fetch(`/api/findings?zone=${encodeURIComponent(zoneFocus)}`).then(r => { if (!r.ok) throw r; return r.json() }),
    ])
      .then(([stats, finds]) => {
        setApiStats(stats)
        setFindings(Array.isArray(finds) ? finds : [])
        setLoading(false)
      })
      .catch(() => { setApiError(true); setLoading(false) })
  }, [hasScanned, zoneFocus])

  if (!hasScanned) return <DashScanGate setActiveTab={setActiveTab} />
  if (loading)     return <DashLoading />
  if (apiError)    return <DashError />

  /* ── Derived metrics ────────────────────────────── */
  const compliance  = Math.max(0, Math.min(100, Math.round(100 - apiStats.avg_risk_score)))
  const postureInfo = getPostureInfo(compliance)
  const riskThreat  = (apiStats.avg_risk_score / 10).toFixed(1)
  const aiConf      = Math.round(apiStats.avg_confidence * 100)

  const withIrap  = findings.filter(f => f.irap_stars != null)
  const avgIrap   = withIrap.length > 0
    ? (withIrap.reduce((s, f) => s + Number(f.irap_stars), 0) / withIrap.length).toFixed(1)
    : '—'

  const confirmedCount = findings.filter(f => f.status === 'CONFIRMED').length
  const pendingCount   = findings.filter(f => f.status === 'PENDING_REVIEW').length
  const rejectedCount  = findings.filter(f => f.status === 'REJECTED').length

  /* ── Category bars ──────────────────────────────── */
  const byClass    = apiStats.by_class || {}
  const maxCatCount = Math.max(...Object.values(byClass), 1)
  const categoryRows = Object.entries(byClass)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([cls, count]) => ({
      cls,
      label: classLabel(cls),
      count,
      widthPct: Math.round((count / maxCatCount) * 100),
      color: CLASS_COLORS[cls] || '#3b82f6',
    }))

  /* ── Severity counts ────────────────────────────── */
  const highCount   = apiStats.by_priority?.HIGH   || 0
  const mediumCount = apiStats.by_priority?.MEDIUM || 0
  const lowCount    = apiStats.by_priority?.LOW    || 0
  const maxSev      = Math.max(highCount, mediumCount, lowCount, 1)

  return (
    <div className="dashboard-page">

      {/* ── Hero banner ──────────────────────── */}
      <div className="hero-banner">
        <div className="hero-left">
          <span className="hero-chip">SELECTED HOSPITAL</span>
          <h1 className="hero-title">{zoneFocus}</h1>
          <p className="hero-desc">
            AI-driven road inspection results sourced from CCTV and field detection pipeline.
            All {apiStats.total_findings} findings evaluated against Saudi MOMAH, KSARAP, and iRAP standards.
            {pendingCount > 0 && ` ${pendingCount} findings are awaiting human-in-the-loop review.`}
          </p>
        </div>
        <div className="hero-right">
          <div className="hero-flaws-label">OVERALL COMPLIANCE POSTURE</div>
          <div className="hero-flaws-count">
            <span className="hero-flaws-num" style={{ color: postureInfo.color }}>{compliance}%</span>
            <span className="hero-flaws-unit" style={{ color: postureInfo.color }}>{postureInfo.label}</span>
          </div>
        </div>
      </div>

      {/* ── Metrics row ──────────────────────── */}
      <div className="metrics-row">
        {/* Identified Flaws card */}
        <div className="metric-card metric-card--donut">
          <div className="metric-card-label">IDENTIFIED FLAWS</div>
          <div className="identified-flaws-center">
            <span className="identified-flaws-num">{apiStats.total_findings}</span>
            <span className="identified-flaws-unit">gaps detected</span>
          </div>
          <div className="donut-footer">
            <div className="donut-foot-item">
              <div className="donut-foot-title">Gaps Detected</div>
              <div className="donut-foot-value donut-foot-value--blue">{apiStats.gaps_detected}</div>
            </div>
            <div className="donut-foot-item">
              <div className="donut-foot-title">Critical (HIGH)</div>
              <div className="donut-foot-value donut-foot-value--red">{apiStats.critical_gaps}</div>
            </div>
          </div>
        </div>

        {/* Middle col — Confirmed Findings donut */}
        <div className="metric-col">
          <div className="metric-card cf-donut-card">
            <div className="metric-card-label">CONFIRMED FINDINGS</div>
            <StatusDonut
              confirmed={confirmedCount}
              pending={pendingCount}
              rejected={rejectedCount}
            />
            <div className="cf-legend">
              <div className="cf-legend-item">
                <span className="cf-dot" style={{ background: '#22c55e' }} />
                <span className="cf-legend-label">Confirmed</span>
                <span className="cf-legend-val">{confirmedCount}</span>
              </div>
              <div className="cf-legend-item">
                <span className="cf-dot" style={{ background: '#f59e0b' }} />
                <span className="cf-legend-label">Pending Review</span>
                <span className="cf-legend-val">{pendingCount}</span>
              </div>
              <div className="cf-legend-item">
                <span className="cf-dot" style={{ background: '#ef4444' }} />
                <span className="cf-legend-label">Rejected</span>
                <span className="cf-legend-val">{rejectedCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right col */}
        <div className="metric-col">
          <StatCard
            icon={<StarIcon />}
            iconBg="#0e1a2a"
            iconBorder="#3b82f6"
            category="AVERAGE iRAP RATING"
            value={
              <span className="stat-irap-row">
                <GoldStar />
                <span className="stat-big">{avgIrap}</span>
                <span className="stat-unit"> stars avg</span>
              </span>
            }
            desc="iRAP star rating (1 = highest risk, 5 = safest). Saudi Vision 2030 target: 3★ minimum on all municipal roads."
          />
          <StatCard
            icon={<WarningTriIcon />}
            iconBg="#2a1f0e"
            iconBorder="#f59e0b"
            category="RISK THREAT ASSESSMENT"
            value={
              <>
                <span className="stat-big">{riskThreat}</span>
                <span className="stat-unit"> / 10 avg</span>
              </>
            }
            desc={`Average composite risk score across ${apiStats.total_findings} detected violations using the MOMAH 4-factor scoring model.`}
          />
        </div>
      </div>

      {/* ── Bottom row ───────────────────────── */}
      <div className="dash-bottom-row">

        {/* Category gaps */}
        <div className="dash-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Total Safety Gaps by Defect Category</h3>
              <p className="panel-subtitle">Top {categoryRows.length} defect classes from AI scan — sorted by frequency</p>
            </div>
            <button className="panel-tag-btn">Road Zone</button>
          </div>
          <div className="category-list">
            {categoryRows.map(row => (
              <div key={row.cls} className="category-row">
                <div className="category-top">
                  <span className="category-name">{row.label}</span>
                  <span className={`flaw-badge${row.count === 0 ? ' flaw-badge--zero' : ''}`}>
                    {row.count} {row.count === 1 ? 'flaw' : 'flaws'}
                  </span>
                </div>
                <div className="category-bar-track">
                  <div
                    className="category-bar-fill"
                    style={{ width: `${row.widthPct}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          {highCount > 0 && (
            <div className="vuln-alert">
              <AlertIcon />
              <span>
                <u>{highCount} HIGH priority</u> violations require immediate field inspection per MOMAH SHC obligations.
              </span>
            </div>
          )}
        </div>

        {/* Severity distribution */}
        <div className="dash-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Risk Severity Distribution</h3>
              <p className="panel-subtitle">Findings grouped by MOMAH priority tier — HIGH / MEDIUM / LOW</p>
            </div>
            <button className="panel-tag-btn">Priority Ranking</button>
          </div>
          <div className="severity-grid">
            <SeverityCol
              label="LOW RISK"
              sub="Minor defects"
              count={lowCount}
              maxVal={maxSev}
              barColor="#22c55e"
              countColor="#22c55e"
              actionLabel="Monitor"
              actionColor="#22c55e"
            />
            <SeverityCol
              label="MEDIUM RISK"
              sub="Schedule fix"
              count={mediumCount}
              maxVal={maxSev}
              barColor="#f59e0b"
              countColor="#f59e0b"
              actionLabel="Plan Action"
              actionColor="#f59e0b"
            />
            <SeverityCol
              label="HIGH RISK"
              sub="Immediate action"
              count={highCount}
              maxVal={maxSev}
              barColor="#ef4444"
              countColor="#ef4444"
              actionLabel="Act Now"
              actionColor="#ef4444"
            />
          </div>
          <div className="severity-notice">
            <NoticeIcon />
            <span>
              {highCount} HIGH-priority violations detected. Immediate escalation recommended per MOMAH SHC and iRAP Road Assessment Programme guidelines.
            </span>
          </div>
        </div>
      </div>

      {/* ── Quick Guide ───────────────────────── */}
      <QuickGuide topClass={apiStats.top_class} />
    </div>
  )
}

/* ─── Severity Column ─────────────────────────────── */
function SeverityCol({ label, sub, count, maxVal, barColor, countColor, actionLabel, actionColor }) {
  const BAR_MAX_H = 110
  const barH = count === 0 ? 6 : Math.max(24, (count / maxVal) * BAR_MAX_H)
  return (
    <div className="severity-col">
      <div className="sev-col-label" style={{ color: countColor }}>{label}</div>
      <div className="sev-col-sub">{sub}</div>
      <div className="sev-chart-area">
        <div className="sev-bar" style={{ height: barH, background: barColor, opacity: count === 0 ? 0.3 : 1 }} />
      </div>
      <div className="sev-count" style={{ color: countColor }}>{count}</div>
      <div className="sev-action" style={{ color: actionColor }}>{actionLabel}</div>
    </div>
  )
}

/* ─── Quick Guide ─────────────────────────────────── */
function QuickGuide({ topClass }) {
  const topLabel = topClass ? classLabel(topClass) : 'unknown'
  return (
    <div className="quick-guide">
      <div className="qg-heading">
        <BulbIcon />
        <span>Quick Interpretation Guide</span>
      </div>
      <div className="qg-cards">
        <div className="qg-card">
          <div className="qg-card-title">Compliance Posture %</div>
          <p className="qg-card-body">
            Calculated as 100 minus the average composite risk score (0–100 scale) across all active findings.
            Higher % = lower average road risk. Targets above 75% for Good Standing.
          </p>
        </div>
        <div className="qg-card">
          <div className="qg-card-title">Top Defect: {topLabel}</div>
          <p className="qg-card-body">
            The most frequently detected defect class in this inspection run.
            Prioritise field crews on this category first to achieve the fastest compliance posture improvement.
          </p>
        </div>
        <div className="qg-card">
          <div className="qg-card-title">Review Workflow</div>
          <p className="qg-card-body">
            AI findings enter PENDING_REVIEW status. Municipal engineers confirm or reject each finding
            via the Safety Defects tab before field action is dispatched via the Balady platform.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Icons ───────────────────────────────────────── */
function WarningTriIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function PulseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
      <circle cx="12" cy="8" r="6"/>
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  )
}

function GoldStar() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#f59e0b" style={{ flexShrink: 0 }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

function NoticeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

function BulbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z"
        stroke="#f59e0b" fill="rgba(245,158,11,0.15)"/>
    </svg>
  )
}
