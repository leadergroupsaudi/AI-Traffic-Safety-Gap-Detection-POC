import React from 'react'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <span className="footer-copy">
        © 2026 Traffic AI road safety compliance models. Provisioned securely as a sandbox environment.
      </span>
      <div className="footer-right">
        <span className="irap-chip">
          <StarIcon /> Global iRAP Target: 3★ Min
        </span>
        <span className="footer-dot">•</span>
        <span className="footer-hospitals">Mapped across 3 Primary Municipal Hospitals</span>
      </div>
    </footer>
  )
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{verticalAlign:'middle', marginRight:3}}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
