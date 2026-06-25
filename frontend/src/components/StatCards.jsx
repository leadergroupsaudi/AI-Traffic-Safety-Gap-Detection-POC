import React from 'react'
import './StatCards.css'

export default function StatCards({ applied, violations, stable }) {
  return (
    <div className="stat-cards-row">
      <StatCard
        category="COVERAGE OVERVIEW"
        categoryColor="var(--text-secondary)"
        value={applied}
        valueColor="var(--text-primary)"
        label="Applied Rulesets"
        description="Active guidelines evaluated concurrently by CCTV machine perception models."
      />
      <StatCard
        category="RULE VIOLATIONS COVERAGE"
        categoryColor="var(--text-secondary)"
        value={violations}
        valueColor="var(--red)"
        label="with detections"
        description="These rules detected active defects, representing areas requiring civil works."
      />
      <StatCard
        category="INTACT BARRIERS (NO GAPS)"
        categoryColor="var(--green)"
        value={stable}
        valueColor="var(--green)"
        label="stable rules"
        description="Rules with 0 active flaws flagged. Indicates healthy, compliant corridor operations."
      />
    </div>
  )
}

function StatCard({ category, categoryColor, value, valueColor, label, description }) {
  return (
    <div className="stat-card">
      <div className="stat-category" style={{ color: categoryColor }}>
        {category}
      </div>
      <div className="stat-value-row">
        <span className="stat-number" style={{ color: valueColor }}>{value}</span>
        <span className="stat-label">{label}</span>
      </div>
      <p className="stat-description">{description}</p>
    </div>
  )
}
