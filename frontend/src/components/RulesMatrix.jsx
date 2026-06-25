import React, { useState } from 'react'
import './RulesMatrix.css'

const CLASS_LABELS = {
  street_light: 'Street Light',
  potholes: 'Potholes',
  missing_road_marking: 'Road Marking',
  manholes: 'Manholes',
  painting_of_curbstone: 'Curbstone',
  construction_waste: 'Constr. Waste',
  waste_accumulation: 'Waste Accum.',
  graffitti: 'Graffiti',
  damaged_commercial_stores_signage: 'Comm. Signage',
  cleanliness_of_public_places: 'Cleanliness',
  damaged_sidewalks: 'Sidewalk',
  damaged_vehicle_on_road: 'Aband. Vehicle',
  safety_and_excavation_works: 'Excavation',
  random_bumps: 'Speed Hump',
  buildings_under_construction: 'Constr. Site',
  fire_hydrant: 'Fire Hydrant',
  emergency_sign: 'Emergency Sign',
  ambulance_entrance: 'Ambul. Entrance',
  main_entrance: 'Main Entrance',
  illegal_parking: 'Illegal Parking',
  ambulance_bay: 'Ambul. Bay',
  ambulance_vehicle: 'Ambul. Vehicle',
  disabled_parking_ground_marking: 'Disabled Pkg',
  pedestrian_crossing: 'Ped. Crossing',
  tactile_paving: 'Tactile Paving',
  traffic_light: 'Traffic Signal',
  emergency_exit_door: 'Emergency Exit',
}

const TYPE_LABELS = {
  direct_detection: 'Detection',
  spacing: 'Spacing',
  co_presence: 'Co-Presence',
  context_spacing: 'Ctx. Spacing',
  context_co_presence: 'Ctx. Co-Pres.',
}

const PRIORITY_COLOR = {
  HIGH: 'var(--red)',
  MEDIUM: 'var(--yellow)',
  LOW: 'var(--green)',
  CRITICAL: '#f97316',
}

export default function RulesMatrix({ rules, setRules, totalFindings, roleState, zoneFocus }) {
  const isAdmin = roleState === 'admin'
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [showPending, setShowPending] = useState(false)

  const activeRules  = rules.filter(r => r.enabled)
  const pendingRules = rules.filter(r => !r.enabled)
  const displayRules = showPending ? rules : activeRules

  const handleDelete = (id, name) => {
    setRules(prev => prev.filter(r => !(r.id === id && r.name === name)))
  }

  const handleEdit = (rule) => {
    setEditTarget({ ...rule })
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditTarget({
      id: '', name: '', standard: '', trigger_class: '', rule_type: 'direct_detection',
      base_score: 0, priority: 'MEDIUM', enabled: true, detections: 0, coverage_pct: 0,
    })
    setShowModal(true)
  }

  const handleSave = (updated) => {
    setRules(prev => {
      const isEdit = editTarget && editTarget.id && editTarget.id === updated.id && editTarget.name === updated.name
      if (isEdit) return prev.map(r => (r.id === editTarget.id && r.name === editTarget.name) ? updated : r)
      return [...prev, { ...updated, detections: 0, coverage_pct: 0 }]
    })
    setShowModal(false)
    setEditTarget(null)
  }

  return (
    <div className="rules-matrix">
      {/* Header */}
      <div className="matrix-header">
        <div>
          <h2 className="matrix-title">
            <DocIcon /> RULE APPLICATION &amp; COVERAGE GAPS MATRIX
          </h2>
          <p className="matrix-subtitle">
            {zoneFocus && <span className="matrix-zone-badge">🏥 {zoneFocus}</span>}
            Coverage rates are calculated from {totalFindings} road inspection findings processed by AI
          </p>
        </div>
        <div className="matrix-header-actions">
          <button
            className={`btn-toggle-pending${showPending ? ' btn-toggle-pending--on' : ''}`}
            onClick={() => setShowPending(v => !v)}
            title={showPending ? 'Hide pending rules' : `Show ${pendingRules.length} pending rules`}
          >
            {showPending ? <EyeOffIcon /> : <EyeIcon />}
            {showPending ? 'Hide Pending' : `+${pendingRules.length} Pending`}
          </button>
          <button
            className={`btn-add-rule${!isAdmin ? ' btn-add-rule--locked' : ''}`}
            onClick={isAdmin ? handleAdd : undefined}
            title={!isAdmin ? 'Switch to Admin role to add rules' : undefined}
            disabled={!isAdmin}
          >
            {!isAdmin && <LockIcon />}
            + Add Custom Rule
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="rules-table">
          <thead>
            <tr>
              <th>CODE</th>
              <th>RULE / STANDARD DEFINITION</th>
              <th>TRIGGER CLASS</th>
              <th>TYPE</th>
              <th>DETECTIONS</th>
              <th>% FINDINGS COVERED</th>
              <th>EDIT TOOL</th>
            </tr>
          </thead>
          <tbody>
            {displayRules.map((rule, idx) => (
              <tr
                key={`${rule.id}-${rule.name}`}
                className={`${idx % 2 === 1 ? 'row-alt' : ''}${!rule.enabled ? ' row-pending' : ''}`}
              >
                {/* Code */}
                <td className="td-code">
                  <span className={`code-badge${!rule.enabled ? ' code-badge--pending' : ''}`}>
                    {rule.id}
                  </span>
                  {!rule.enabled && <span className="pending-label">PENDING</span>}
                </td>

                {/* Definition */}
                <td className="td-definition">
                  <div className="rule-name">{rule.name}</div>
                  <div className="rule-desc rule-desc--standard">{rule.standard}</div>
                </td>

                {/* Trigger class */}
                <td className="td-discipline">
                  <span className="discipline-badge">
                    {CLASS_LABELS[rule.trigger_class] || rule.trigger_class || '—'}
                  </span>
                </td>

                {/* Rule type */}
                <td className="td-type">
                  <span className="type-badge">
                    {TYPE_LABELS[rule.rule_type] || rule.rule_type || '—'}
                  </span>
                </td>

                {/* Detections */}
                <td className="td-detections">
                  {rule.detections > 0
                    ? (
                      <span className="detection-badge">
                        <span
                          className="det-dot"
                          style={{ background: PRIORITY_COLOR[rule.priority] || 'var(--red)' }}
                        />
                        {rule.detections} active
                      </span>
                    )
                    : <span className="no-detection">—</span>
                  }
                </td>

                {/* Coverage */}
                <td className="td-coverage">
                  {rule.enabled ? (
                    <div className="coverage-wrap">
                      <span className="coverage-pct">{rule.coverage_pct}%</span>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${rule.coverage_pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="no-detection">—</span>
                  )}
                </td>

                {/* Edit tools */}
                <td className="td-tools">
                  <div className="tool-btns">
                    <button
                      className={`tool-btn${!isAdmin ? ' tool-btn--locked' : ''}`}
                      title={isAdmin ? 'Edit rule' : 'Switch to Admin to edit rules'}
                      onClick={isAdmin ? () => handleEdit(rule) : undefined}
                      disabled={!isAdmin}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      className={`tool-btn tool-btn--delete${!isAdmin ? ' tool-btn--locked' : ''}`}
                      title={isAdmin ? 'Delete rule' : 'Switch to Admin to delete rules'}
                      onClick={isAdmin ? () => handleDelete(rule.id, rule.name) : undefined}
                      disabled={!isAdmin}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {displayRules.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">Loading rules…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <RuleModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

/* ── Add/Edit Modal ──────────────────────────── */
function RuleModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial)
  const isNew = !initial?.id || initial.id === ''

  const set    = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const setNum = (k) => (e) => setForm(f => ({ ...f, [k]: Number(e.target.value) }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.id.trim() || !form.name.trim()) return
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'Add Custom Rule' : 'Edit Rule'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Rule Code
            <input value={form.id} onChange={set('id')} placeholder="e.g. R-15" required />
          </label>
          <label>
            Rule Name
            <input value={form.name} onChange={set('name')} placeholder="Rule title" required />
          </label>
          <label>
            Standard
            <textarea value={form.standard} onChange={set('standard')} rows={2} placeholder="Applicable standard reference..." />
          </label>
          <div className="modal-row">
            <label>
              Trigger Class
              <input value={form.trigger_class} onChange={set('trigger_class')} placeholder="e.g. potholes" />
            </label>
            <label>
              Rule Type
              <select value={form.rule_type} onChange={set('rule_type')}>
                <option value="direct_detection">Detection</option>
                <option value="spacing">Spacing</option>
                <option value="co_presence">Co-Presence</option>
              </select>
            </label>
          </div>
          <div className="modal-row">
            <label>
              Base Score
              <input type="number" min="0" max="100" value={form.base_score} onChange={setNum('base_score')} />
            </label>
            <label>
              Priority
              <select value={form.priority} onChange={set('priority')}>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save">
              {isNew ? 'Add Rule' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── SVG Icons ─────────────────────────────── */
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
