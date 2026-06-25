// jsPDF and html2canvas are loaded lazily on first use (code-split)

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const PW = 794   // page width px  (≈ A4 @ 96 dpi)
const PAD = 40   // horizontal padding

const C = {
  blue:        '#2563eb',
  blueDark:    '#1d4ed8',
  blueLight:   '#eff6ff',
  red:         '#dc2626',
  redLight:    '#fef2f2',
  redBorder:   '#fecaca',
  orange:      '#ea580c',
  orangeLight: '#fff7ed',
  orangeBorder:'#fed7aa',
  yellow:      '#d97706',
  yellowLight: '#fffbeb',
  yellowBorder:'#fde68a',
  green:       '#16a34a',
  greenLight:  '#f0fdf4',
  greenBorder: '#bbf7d0',
  text:        '#1e293b',
  textGray:    '#64748b',
  textLight:   '#94a3b8',
  border:      '#e2e8f0',
  cardBg:      '#f8fafc',
  white:       '#ffffff',
}

const CLASS_LABELS = {
  street_light:       'Street Lights',
  manholes:           'Manhole Covers',
  emergency_sign:     'Emergency Sign',
  ambulance_entrance: 'Ambulance Entrance',
}

const ZONES = [
  'St. Jude Trauma Center',
  'City General Memorial',
  "Mercy Women & Children's",
]
const label = (cls) => CLASS_LABELS[cls] || cls

function priorityColor(p) {
  if (p === 'HIGH')   return C.red
  if (p === 'MEDIUM') return C.yellow
  return C.green
}
function priorityBg(p) {
  if (p === 'HIGH')   return C.redLight
  if (p === 'MEDIUM') return C.yellowLight
  return C.greenLight
}
function priorityBorder(p) {
  if (p === 'HIGH')   return C.redBorder
  if (p === 'MEDIUM') return C.yellowBorder
  return C.greenBorder
}
function statusColor(s) {
  if (s === 'CONFIRMED')     return C.red
  if (s === 'REJECTED')      return C.green
  if (s === 'PENDING_REVIEW') return C.yellow
  return C.textGray
}
function statusLabel(s) {
  if (s === 'PENDING_REVIEW') return 'PENDING'
  return s || '—'
}

/* ─────────────────────────────────────────────────────────────
   Shared page header (reused in every page except cover)
───────────────────────────────────────────────────────────── */
function pageHeader(pageNum, totalPages) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;
                margin-bottom:22px;padding-bottom:10px;border-bottom:2px solid ${C.blue};">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:28px;height:28px;background:${C.blue};border-radius:6px;
                    display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0 0 8h10a4 4 0 0 0 0-8V7a5 5 0 0 0-5-5z"
                  stroke="white" stroke-width="1.6" fill="none"/>
          </svg>
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;color:${C.text};">Traffic AI — Road Safety Report</div>
          <div style="font-size:10px;color:${C.textGray};">MOMAH / SHC 602 / SASO 2927:2019 / iRAP</div>
        </div>
      </div>
      <div style="font-size:10px;color:${C.textLight};">Page ${pageNum} of ${totalPages}</div>
    </div>
  `
}

/* ─────────────────────────────────────────────────────────────
   Multi-site hospital comparison section (injected into page 1)
───────────────────────────────────────────────────────────── */
function buildHospitalSummarySection(allZoneData, currentZone) {
  if (!allZoneData || allZoneData.length === 0) return ''

  const cards = allZoneData.map((zd, idx) => {
    const s      = zd.stats || {}
    const fs     = zd.findings || []
    const total  = s.total_findings || 0
    const high   = (s.by_priority || {}).HIGH   || 0
    const medium = (s.by_priority || {}).MEDIUM || 0
    const low    = (s.by_priority || {}).LOW    || 0
    const comp   = Math.max(0, Math.min(100, Math.round(100 - (s.avg_risk_score || 0))))
    const conf   = fs.filter(f => f.status === 'CONFIRMED').length
    const pend   = fs.filter(f => f.status === 'PENDING_REVIEW').length
    const rej    = fs.filter(f => f.status === 'REJECTED').length
    const isCurrent = zd.zone === currentZone

    // Risk bar proportions
    const nonZeroTotal = Math.max(total, 1)
    const hPct = Math.round((high   / nonZeroTotal) * 100)
    const mPct = Math.round((medium / nonZeroTotal) * 100)
    const lPct = Math.max(0, 100 - hPct - mPct)

    // Compliance colour
    const compColor = comp >= 70 ? C.green : comp >= 50 ? C.yellow : C.red
    const compBg    = comp >= 70 ? C.greenLight : comp >= 50 ? C.yellowLight : C.redLight
    const compBd    = comp >= 70 ? C.greenBorder : comp >= 50 ? C.yellowBorder : C.redBorder

    const borderStyle = isCurrent
      ? `border:2px solid ${C.blue};`
      : `border:1px solid ${C.border};`

    return `
      <div style="flex:1;${borderStyle}border-radius:10px;padding:14px 16px;background:${C.cardBg};
                  position:relative;">
        ${isCurrent ? `
          <div style="position:absolute;top:-1px;right:10px;background:${C.blue};border-radius:0 0 6px 6px;
                      padding:2px 9px;font-size:9px;font-weight:700;color:white;letter-spacing:0.07em;">
            CURRENT ZONE
          </div>
        ` : ''}

        <!-- Index + name -->
        <div style="font-size:9.5px;font-weight:700;color:${C.textGray};letter-spacing:0.05em;
                    text-transform:uppercase;margin-bottom:4px;">Hospital ${idx + 1} of ${allZoneData.length}</div>
        <div style="font-size:12.5px;font-weight:800;color:${C.text};margin-bottom:12px;line-height:1.3;">
          ${zd.zone}
        </div>

        <!-- Total findings big number -->
        <div style="font-size:36px;font-weight:900;color:${C.red};line-height:1;">${total}</div>
        <div style="font-size:10px;color:${C.textGray};margin-bottom:10px;letter-spacing:0.03em;">total findings</div>

        <!-- Risk stacked bar -->
        <div style="display:flex;height:7px;border-radius:4px;overflow:hidden;margin-bottom:8px;gap:1px;">
          ${hPct > 0 ? `<div style="flex:${hPct};background:${C.red};"></div>` : ''}
          ${mPct > 0 ? `<div style="flex:${mPct};background:${C.yellow};"></div>` : ''}
          ${lPct > 0 ? `<div style="flex:${lPct};background:${C.green};"></div>` : ''}
        </div>

        <!-- H / M / L pill row -->
        <div style="display:flex;gap:5px;margin-bottom:11px;">
          ${[
            { lbl:'H', val:high,   c:C.red,    bg:C.redLight,    bd:C.redBorder },
            { lbl:'M', val:medium, c:C.yellow, bg:C.yellowLight, bd:C.yellowBorder },
            { lbl:'L', val:low,    c:C.green,  bg:C.greenLight,  bd:C.greenBorder },
          ].map(p => `
            <div style="flex:1;padding:4px 6px;background:${p.bg};border:1px solid ${p.bd};
                        border-radius:6px;text-align:center;">
              <div style="font-size:9px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                          margin-bottom:1px;">${p.lbl}</div>
              <div style="font-size:14px;font-weight:800;color:${p.c};">${p.val}</div>
            </div>
          `).join('')}
        </div>

        <!-- Compliance score -->
        <div style="padding:8px 12px;background:${compBg};border:1px solid ${compBd};
                    border-radius:7px;display:flex;justify-content:space-between;
                    align-items:center;margin-bottom:10px;">
          <div style="font-size:9.5px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                      letter-spacing:0.05em;">Compliance</div>
          <div style="font-size:18px;font-weight:900;color:${compColor};">${comp}%</div>
        </div>

        <!-- Confirmed / Pending / Rejected -->
        <div style="display:flex;gap:4px;">
          ${[
            { lbl:'Confirmed', val:conf, c:C.red },
            { lbl:'Pending',   val:pend, c:C.yellow },
            { lbl:'Rejected',  val:rej,  c:C.green },
          ].map(r => `
            <div style="flex:1;text-align:center;">
              <div style="font-size:14px;font-weight:800;color:${r.c};">${r.val}</div>
              <div style="font-size:8.5px;color:${C.textGray};text-transform:uppercase;
                          letter-spacing:0.04em;">${r.lbl}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }).join('')

  return `
    <div style="padding-top:18px;border-top:2px solid ${C.border};">
      <div style="font-size:11px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                  letter-spacing:0.09em;margin-bottom:14px;">
        MULTI-SITE HOSPITAL NETWORK — COMPARATIVE SUMMARY
      </div>
      <div style="display:flex;gap:12px;">
        ${cards}
      </div>
    </div>
  `
}

/* ─────────────────────────────────────────────────────────────
   PAGE 1 — Executive Summary
───────────────────────────────────────────────────────────── */
function buildPage1(stats, findings, zoneFocus, allZoneData) {
  const total   = stats.total_findings || 0
  const high    = (stats.by_priority || {}).HIGH   || 0
  const medium  = (stats.by_priority || {}).MEDIUM || 0
  const low     = (stats.by_priority || {}).LOW    || 0
  const avgRisk = Number(stats.avg_risk_score || 0).toFixed(1)
  const aiConf  = Math.round((stats.avg_confidence || 0) * 100)
  const compliance = Math.max(0, Math.min(100, Math.round(100 - (stats.avg_risk_score || 0))))
  const confirmed = findings.filter(f => f.status === 'CONFIRMED').length
  const pending   = findings.filter(f => f.status === 'PENDING_REVIEW').length
  const rejected  = findings.filter(f => f.status === 'REJECTED').length

  const irapVals = findings.map(f => Number(f.irap_stars) || 0).filter(s => s > 0)
  const avgIrap  = irapVals.length
    ? (irapVals.reduce((a, b) => a + b, 0) / irapVals.length).toFixed(1)
    : '—'

  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const kpis = [
    { lbl:'Total Findings',  val: total,       unit:'',  c:C.blue,   bg:C.blueLight,   bd:'#bfdbfe' },
    { lbl:'HIGH Priority',   val: high,         unit:'',  c:C.red,    bg:C.redLight,    bd:C.redBorder },
    { lbl:'Compliance',      val:`${compliance}%`, unit:'', c:C.blue,  bg:C.blueLight,   bd:'#bfdbfe' },
    { lbl:'AI Confidence',   val:`${aiConf}%`,  unit:'',  c:C.green,  bg:C.greenLight,  bd:C.greenBorder },
    { lbl:'Avg iRAP Stars',  val: avgIrap,      unit:'★', c:C.yellow, bg:C.yellowLight, bd:C.yellowBorder },
    { lbl:'Avg Risk Score',  val: avgRisk,      unit:'/100', c:C.orange, bg:C.orangeLight, bd:C.orangeBorder },
  ]

  return `
<div style="width:${PW}px;font-family:'Segoe UI',Arial,sans-serif;background:white;box-sizing:border-box;">

  <!-- ── Cover banner ─────────────────────────────── -->
  <div style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%);
              padding:34px ${PAD}px 28px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.6);margin-bottom:8px;">
        AI-ASSISTED ROAD SAFETY INSPECTION
      </div>
      <div style="font-size:28px;font-weight:900;color:white;line-height:1.15;margin-bottom:7px;">
        Road Safety Inspection Report
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.72);">
        MOMAH · Saudi Highway Code SHC 602 · SASO 2927:2019 · KSARAP / iRAP Standards
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:3px;">GENERATED</div>
      <div style="font-size:14px;font-weight:700;color:white;">${date}</div>
      <div style="margin-top:10px;background:rgba(255,255,255,0.14);border-radius:6px;padding:5px 14px;
                  font-size:10px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:0.08em;">
        EXECUTIVE SUMMARY
      </div>
    </div>
  </div>

  <!-- ── Body ──────────────────────────────────────── -->
  <div style="padding:28px ${PAD}px 32px;">

    <!-- Zone + status row -->
    <div style="display:flex;gap:14px;margin-bottom:22px;">
      <div style="flex:1;padding:14px 18px;background:${C.cardBg};border:1px solid ${C.border};border-radius:8px;">
        <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                    letter-spacing:0.07em;margin-bottom:5px;">Inspection Zone</div>
        <div style="font-size:15px;font-weight:700;color:${C.text};">🏥 ${zoneFocus}</div>
      </div>
      ${[
        { lbl:'HIGH',    val: high,    c:C.red,    bg:C.redLight,    bd:C.redBorder },
        { lbl:'MEDIUM',  val: medium,  c:C.yellow, bg:C.yellowLight, bd:C.yellowBorder },
        { lbl:'LOW',     val: low,     c:C.green,  bg:C.greenLight,  bd:C.greenBorder },
      ].map(s => `
        <div style="padding:14px 18px;background:${s.bg};border:1px solid ${s.bd};
                    border-radius:8px;text-align:center;min-width:80px;">
          <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                      letter-spacing:0.06em;margin-bottom:5px;">${s.lbl}</div>
          <div style="font-size:24px;font-weight:800;color:${s.c};">${s.val}</div>
        </div>
      `).join('')}
    </div>

    <!-- KPI cards -->
    <div style="display:flex;gap:12px;margin-bottom:22px;">
      ${kpis.map(k => `
        <div style="flex:1;background:${k.bg};border:1px solid ${k.bd};border-radius:10px;padding:16px 18px;">
          <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                      letter-spacing:0.06em;margin-bottom:8px;">${k.lbl}</div>
          <div style="font-size:26px;font-weight:900;color:${k.c};line-height:1;">
            ${k.val}<span style="font-size:13px;font-weight:500;color:${C.textGray};margin-left:2px;">${k.unit}</span>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Review status -->
    <div style="display:flex;gap:12px;margin-bottom:22px;">
      ${[
        { lbl:'Confirmed',     val:confirmed, c:C.red,    bg:C.redLight,    bd:C.redBorder },
        { lbl:'Pending Review',val:pending,   c:C.yellow, bg:C.yellowLight, bd:C.yellowBorder },
        { lbl:'Rejected',      val:rejected,  c:C.green,  bg:C.greenLight,  bd:C.greenBorder },
      ].map(s => `
        <div style="flex:1;padding:14px 18px;background:${s.bg};border:1px solid ${s.bd};border-radius:8px;">
          <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                      letter-spacing:0.06em;margin-bottom:6px;">${s.lbl}</div>
          <div style="font-size:22px;font-weight:800;color:${s.c};">${s.val}</div>
        </div>
      `).join('')}
    </div>

    <!-- Summary paragraph -->
    <div style="padding:16px 20px;background:${C.blueLight};border-left:4px solid ${C.blue};
                border-radius:0 8px 8px 0;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:700;color:${C.blueDark};text-transform:uppercase;
                  letter-spacing:0.08em;margin-bottom:6px;">INSPECTION SUMMARY</div>
      <div style="font-size:12px;color:${C.text};line-height:1.7;">
        This AI-assisted road inspection identified <strong>${total} safety defects</strong> across the
        surveyed corridor — <strong>${high} HIGH priority</strong> issues require urgent civil works
        within 30 days per KSARAP guidelines. The overall compliance rate is
        <strong>${compliance}%</strong> based on an average risk score of
        <strong>${avgRisk}/100</strong>. The YOLO detection engine ran at
        <strong>${aiConf}% average confidence</strong>, and the mean iRAP safety rating across all
        findings is <strong>${avgIrap} stars</strong>. Findings were validated against MOMAH General
        Specifications, Saudi Highway Code SHC 602, and SASO 2927:2019 lighting standards.
        ${confirmed} findings have been confirmed by human reviewers and require immediate
        coordination with the responsible municipal authority.
      </div>
    </div>

    <!-- ── Multi-site hospital network comparison ── -->
    ${buildHospitalSummarySection(allZoneData, zoneFocus)}

  </div>
</div>`
}

/* ─────────────────────────────────────────────────────────────
   PAGE 2 — Dashboard Visualizations
───────────────────────────────────────────────────────────── */
function buildPage2(stats, findings) {
  const total      = stats.total_findings || 1
  const avgRisk    = Number(stats.avg_risk_score || 0).toFixed(1)
  const aiConf     = Math.round((stats.avg_confidence || 0) * 100)
  const compliance = Math.max(0, Math.min(100, Math.round(100 - (stats.avg_risk_score || 0))))
  const topClass   = stats.top_class || ''
  const byClass    = stats.by_class    || {}
  const byPriority = stats.by_priority || {}

  const irapVals = findings.map(f => Number(f.irap_stars) || 0).filter(s => s > 0)
  const avgIrap  = irapVals.length
    ? (irapVals.reduce((a, b) => a + b, 0) / irapVals.length).toFixed(1)
    : '—'

  const high   = byPriority.HIGH   || 0
  const medium = byPriority.MEDIUM || 0
  const low    = byPriority.LOW    || 0
  const maxSev = Math.max(high, medium, low, 1)

  // Donut ring (SVG stroke-dasharray trick)
  const r   = 66
  const circ = parseFloat((2 * Math.PI * r).toFixed(1))
  const dash = parseFloat(((compliance / 100) * circ).toFixed(1))
  const offset = parseFloat((circ * 0.25).toFixed(1))

  // Top 7 categories (horizontal bars)
  const cats = Object.entries(byClass).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const maxCat = cats.length ? cats[0][1] : 1

  const catBars = cats.map(([cls, cnt]) => {
    const barPct = Math.round((cnt / maxCat) * 100)
    const covPct = Math.round((cnt / total) * 100)
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-size:11.5px;font-weight:600;color:${C.text};">${label(cls)}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:10px;color:${C.textGray};">${covPct}% of total</span>
            <span style="font-size:11px;font-weight:700;background:#fee2e2;color:${C.red};
                         border:1px solid #fecaca;border-radius:4px;padding:1px 7px;">${cnt}</span>
          </div>
        </div>
        <div style="height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${barPct}%;background:${C.blue};border-radius:4px;"></div>
        </div>
      </div>
    `
  }).join('')

  return `
<div style="width:${PW}px;font-family:'Segoe UI',Arial,sans-serif;background:white;
            box-sizing:border-box;padding:28px ${PAD}px 32px;">

  ${pageHeader(2, 3)}

  <div style="font-size:16px;font-weight:800;color:${C.text};margin:0 0 20px;
              padding-bottom:8px;border-bottom:1px solid ${C.border};">
    📊 Platform Dashboard — Risk Analysis Visualizations
  </div>

  <!-- ── Top row: donut + right metrics ──────────── -->
  <div style="display:flex;gap:18px;margin-bottom:20px;">

    <!-- Compliance donut -->
    <div style="flex-shrink:0;width:210px;background:${C.cardBg};border:1px solid ${C.border};
                border-radius:12px;padding:18px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                  letter-spacing:0.07em;margin-bottom:10px;">COMPLIANCE SCORE</div>
      <svg width="174" height="174" viewBox="0 0 174 174">
        <!-- track -->
        <circle cx="87" cy="87" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="17"/>
        <!-- progress -->
        <circle cx="87" cy="87" r="${r}" fill="none" stroke="${C.blue}" stroke-width="17"
                stroke-dasharray="${dash} ${circ}"
                stroke-dashoffset="${offset}"
                stroke-linecap="round"
                transform="rotate(-90 87 87)"/>
        <text x="87" y="83" text-anchor="middle" font-size="30" font-weight="900"
              fill="${C.text}" font-family="Segoe UI,Arial,sans-serif">${compliance}%</text>
        <text x="87" y="100" text-anchor="middle" font-size="11" fill="${C.textGray}"
              font-family="Segoe UI,Arial,sans-serif">COMPLIANT</text>
      </svg>
      <div style="display:flex;justify-content:space-around;padding-top:10px;
                  border-top:1px solid ${C.border};margin-top:2px;">
        <div>
          <div style="font-size:9.5px;color:${C.textGray};margin-bottom:2px;">Risk Score</div>
          <div style="font-size:13px;font-weight:700;color:${C.red};">${avgRisk}</div>
        </div>
        <div>
          <div style="font-size:9.5px;color:${C.textGray};margin-bottom:2px;">AI Conf.</div>
          <div style="font-size:13px;font-weight:700;color:${C.blue};">${aiConf}%</div>
        </div>
        <div>
          <div style="font-size:9.5px;color:${C.textGray};margin-bottom:2px;">iRAP ★</div>
          <div style="font-size:13px;font-weight:700;color:${C.yellow};">${avgIrap}</div>
        </div>
      </div>
    </div>

    <!-- Right: iRAP + top defect + detection stats -->
    <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
      <!-- iRAP -->
      <div style="background:${C.yellowLight};border:1px solid ${C.yellowBorder};border-radius:10px;
                  padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                      letter-spacing:0.06em;margin-bottom:4px;">AVG iRAP SAFETY RATING</div>
          <div style="font-size:24px;font-weight:900;color:${C.yellow};">${avgIrap} ★</div>
        </div>
        <div style="font-size:11px;color:${C.textGray};max-width:200px;line-height:1.5;">
          Scale: 1 (highest risk) → 5 (safest).<br/>Mapped from KSARAP risk thresholds.
        </div>
      </div>
      <!-- Top defect -->
      <div style="background:${C.orangeLight};border:1px solid ${C.orangeBorder};border-radius:10px;
                  padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                      letter-spacing:0.06em;margin-bottom:4px;">TOP DEFECT CLASS</div>
          <div style="font-size:18px;font-weight:800;color:${C.orange};">${label(topClass)}</div>
          <div style="font-size:10.5px;color:${C.textGray};margin-top:2px;">Most frequently detected defect</div>
        </div>
        <div style="font-size:32px;font-weight:900;color:${C.orangeBorder};">${byClass[topClass] || 0}</div>
      </div>
      <!-- Detection counts row -->
      <div style="display:flex;gap:10px;">
        ${[
          { lbl:'Gaps Detected', val: stats.gaps_detected || 0,  c:C.blue,   bg:C.blueLight,   bd:'#bfdbfe' },
          { lbl:'Critical Gaps', val: stats.critical_gaps || 0,  c:C.red,    bg:C.redLight,    bd:C.redBorder },
          { lbl:'Total Findings',val: stats.total_findings || 0, c:C.text,   bg:C.cardBg,      bd:C.border },
        ].map(s => `
          <div style="flex:1;padding:12px 14px;background:${s.bg};border:1px solid ${s.bd};border-radius:8px;">
            <div style="font-size:10px;font-weight:600;color:${C.textGray};text-transform:uppercase;
                        letter-spacing:0.05em;margin-bottom:5px;">${s.lbl}</div>
            <div style="font-size:20px;font-weight:800;color:${s.c};">${s.val}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- ── Bottom row: categories + severity ────────── -->
  <div style="display:flex;gap:18px;">

    <!-- Category bars -->
    <div style="flex:1.5;background:${C.cardBg};border:1px solid ${C.border};border-radius:12px;
                padding:18px 20px;">
      <div style="font-size:12px;font-weight:700;color:${C.text};margin-bottom:14px;
                  padding-bottom:8px;border-bottom:1px solid ${C.border};">
        DEFECT CATEGORY BREAKDOWN
      </div>
      ${catBars}
    </div>

    <!-- Severity distribution -->
    <div style="flex:1;background:${C.cardBg};border:1px solid ${C.border};border-radius:12px;
                padding:18px 20px;display:flex;flex-direction:column;">
      <div style="font-size:12px;font-weight:700;color:${C.text};margin-bottom:14px;
                  padding-bottom:8px;border-bottom:1px solid ${C.border};">
        SEVERITY DISTRIBUTION
      </div>
      <div style="flex:1;display:flex;gap:12px;align-items:flex-end;justify-content:center;min-height:120px;">
        ${[
          { lbl:'HIGH',   cnt:high,   c:C.red,    bg:'#fca5a5' },
          { lbl:'MEDIUM', cnt:medium, c:C.yellow, bg:'#fcd34d' },
          { lbl:'LOW',    cnt:low,    c:C.green,  bg:'#86efac' },
        ].map(s => {
          const bh = Math.max(10, Math.round((s.cnt / maxSev) * 110))
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;">
              <div style="font-size:18px;font-weight:800;color:${s.c};">${s.cnt}</div>
              <div style="width:100%;height:${bh}px;background:${s.bg};border-radius:6px 6px 0 0;
                          border:1px solid ${s.c};border-bottom:none;min-height:10px;"></div>
              <div style="font-size:10px;font-weight:700;color:${C.textGray};text-transform:uppercase;
                          letter-spacing:0.05em;">${s.lbl}</div>
            </div>
          `
        }).join('')}
      </div>
      <div style="margin-top:14px;padding:10px 12px;background:${C.yellowLight};
                  border:1px solid ${C.yellowBorder};border-radius:6px;
                  font-size:11px;color:${C.text};line-height:1.55;">
        ⚠ HIGH → within <strong>30 days</strong> (KSARAP) ·
        MEDIUM → within <strong>90 days</strong> ·
        LOW → next inspection cycle
      </div>
    </div>

  </div>
</div>`
}

/* ─────────────────────────────────────────────────────────────
   PAGE 3+ — Findings Table (paginated)
───────────────────────────────────────────────────────────── */
const ROWS_PER_PAGE = 22

function buildFindingsPage(findings, startIdx, pageNum, totalPages) {
  const slice   = findings.slice(startIdx, startIdx + ROWS_PER_PAGE)
  const isFirst = startIdx === 0

  const thead = `
    <tr style="background:${C.blue};">
      <th style="padding:9px 7px;text-align:left;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;white-space:nowrap;">FINDING ID</th>
      <th style="padding:9px 7px;text-align:left;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;">RULE / VIOLATION</th>
      <th style="padding:9px 7px;text-align:left;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;white-space:nowrap;">CLASS</th>
      <th style="padding:9px 7px;text-align:center;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;white-space:nowrap;">SCORE</th>
      <th style="padding:9px 7px;text-align:left;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;white-space:nowrap;">PRIORITY</th>
      <th style="padding:9px 7px;text-align:left;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;white-space:nowrap;">iRAP</th>
      <th style="padding:9px 7px;text-align:left;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;white-space:nowrap;">STATUS</th>
      <th style="padding:9px 7px;text-align:left;font-size:10px;font-weight:700;color:white;
                 letter-spacing:0.05em;white-space:nowrap;">LOCATION</th>
    </tr>
  `

  const contHead = `
    <tr style="background:${C.cardBg};border-bottom:1px solid ${C.border};">
      <th style="padding:7px 7px;text-align:left;font-size:9.5px;font-weight:700;
                 color:${C.textGray};letter-spacing:0.05em;white-space:nowrap;">FINDING ID</th>
      <th style="padding:7px 7px;text-align:left;font-size:9.5px;font-weight:700;
                 color:${C.textGray};">RULE / VIOLATION</th>
      <th style="padding:7px 7px;text-align:left;font-size:9.5px;font-weight:700;
                 color:${C.textGray};white-space:nowrap;">CLASS</th>
      <th style="padding:7px 7px;text-align:center;font-size:9.5px;font-weight:700;
                 color:${C.textGray};white-space:nowrap;">SCORE</th>
      <th style="padding:7px 7px;text-align:left;font-size:9.5px;font-weight:700;
                 color:${C.textGray};white-space:nowrap;">PRIORITY</th>
      <th style="padding:7px 7px;text-align:left;font-size:9.5px;font-weight:700;
                 color:${C.textGray};white-space:nowrap;">iRAP</th>
      <th style="padding:7px 7px;text-align:left;font-size:9.5px;font-weight:700;
                 color:${C.textGray};white-space:nowrap;">STATUS</th>
      <th style="padding:7px 7px;text-align:left;font-size:9.5px;font-weight:700;
                 color:${C.textGray};white-space:nowrap;">LOCATION</th>
    </tr>
  `

  const rows = slice.map((f, i) => {
    const bg   = i % 2 === 0 ? C.white : C.cardBg
    const pc   = priorityColor(f.risk_priority)
    const pbg  = priorityBg(f.risk_priority)
    const pbd  = priorityBorder(f.risk_priority)
    const sc   = statusColor(f.status)
    const loc  = f.position_start_meters
      ? `~${Math.round(Number(f.position_start_meters))}m`
      : '—'
    const starsN = Number(f.irap_stars) || 0
    const stars  = '★'.repeat(starsN) + '☆'.repeat(Math.max(0, 5 - starsN))
    const ruleName = (f.rule_name || '').length > 42
      ? (f.rule_name || '').substring(0, 42) + '…'
      : (f.rule_name || '')

    return `
      <tr style="background:${bg};border-bottom:1px solid ${C.border};">
        <td style="padding:6px 7px;font-size:9.5px;font-weight:700;color:${C.blue};white-space:nowrap;">
          ${f.finding_id || '—'}
        </td>
        <td style="padding:6px 7px;font-size:10.5px;color:${C.text};max-width:170px;">
          <div style="font-weight:600;line-height:1.3;">${ruleName}</div>
          <div style="font-size:9.5px;color:${C.textGray};margin-top:1px;">${f.rule_id || ''}</div>
        </td>
        <td style="padding:6px 7px;font-size:10.5px;color:${C.text};white-space:nowrap;">
          ${label(f.trigger_class)}
        </td>
        <td style="padding:6px 7px;text-align:center;">
          <span style="font-size:13px;font-weight:800;color:${pc};">${f.risk_score || 0}</span>
        </td>
        <td style="padding:6px 7px;">
          <span style="font-size:9.5px;font-weight:700;padding:2px 7px;background:${pbg};
                       color:${pc};border:1px solid ${pbd};border-radius:4px;white-space:nowrap;">
            ${f.risk_priority || '—'}
          </span>
        </td>
        <td style="padding:6px 7px;font-size:11px;color:${C.yellow};white-space:nowrap;letter-spacing:0.02em;">
          ${stars}
        </td>
        <td style="padding:6px 7px;">
          <span style="font-size:9.5px;font-weight:700;padding:2px 7px;background:${pbg};
                       color:${sc};border:1px solid ${pbd};border-radius:4px;white-space:nowrap;">
            ${statusLabel(f.status)}
          </span>
        </td>
        <td style="padding:6px 7px;font-size:10.5px;color:${C.textGray};white-space:nowrap;">
          ${loc}
        </td>
      </tr>
    `
  }).join('')

  const isLast = startIdx + ROWS_PER_PAGE >= findings.length

  return `
<div style="width:${PW}px;font-family:'Segoe UI',Arial,sans-serif;background:white;
            box-sizing:border-box;padding:28px ${PAD}px 32px;">

  ${pageHeader(pageNum, totalPages)}

  ${isFirst ? `
    <div style="font-size:16px;font-weight:800;color:${C.text};margin:0 0 20px;
                padding-bottom:8px;border-bottom:1px solid ${C.border};">
      🔎 Safety Defects &amp; Findings — Complete Inspection Log
    </div>
    <div style="font-size:11.5px;color:${C.textGray};margin-bottom:14px;">
      Showing all ${findings.length} findings · Sorted by detection order ·
      Evaluated under MOMAH / KSARAP / iRAP standards
    </div>
  ` : `
    <div style="font-size:11px;color:${C.textGray};margin-bottom:14px;">
      Continued — records ${startIdx + 1}–${Math.min(startIdx + ROWS_PER_PAGE, findings.length)}
      of ${findings.length}
    </div>
  `}

  <table style="width:100%;border-collapse:collapse;font-family:'Segoe UI',Arial,sans-serif;">
    <thead>${isFirst ? thead : contHead}</thead>
    <tbody>${rows}</tbody>
  </table>

  ${isLast ? `
    <div style="margin-top:20px;padding:12px 16px;background:${C.blueLight};
                border:1px solid #bfdbfe;border-radius:8px;
                font-size:11px;color:${C.blueDark};">
      ✓ All ${findings.length} findings listed. Generated by Traffic AI Road Safety Systems —
      powered by YOLO object detection + MOMAH/KSARAP automated rule engine.
    </div>
  ` : ''}
</div>`
}

/* ─────────────────────────────────────────────────────────────
   DOM capture helper  (html2canvas injected lazily)
───────────────────────────────────────────────────────────── */
async function captureHtml(html, html2canvas) {
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    zIndex: '-9999',
    background: 'white',
  })
  host.innerHTML = html
  document.body.appendChild(host)

  const target = host.firstElementChild
  await new Promise(r => setTimeout(r, 80))   // allow layout paint

  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: PW,
    windowWidth: PW + 2 * PAD,
  })

  document.body.removeChild(host)
  return canvas
}

/* ─────────────────────────────────────────────────────────────
   Public export
───────────────────────────────────────────────────────────── */
export async function generateReport(zoneFocus = 'Road Inspection Zone') {
  // Lazy-load PDF libraries and fetch all 3 hospital zones concurrently
  const [{ jsPDF }, { default: html2canvas }, allZoneData] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
    Promise.all(
      ZONES.map(z =>
        Promise.all([
          fetch(`/api/stats?zone=${encodeURIComponent(z)}`).then(r => r.json()).catch(() => ({})),
          fetch(`/api/findings?zone=${encodeURIComponent(z)}`).then(r => r.json()).catch(() => []),
        ]).then(([s, f]) => ({ zone: z, stats: s, findings: Array.isArray(f) ? f : [] }))
      )
    ),
  ])

  const currentZoneData = allZoneData.find(d => d.zone === zoneFocus)
    || allZoneData[0]
    || { zone: zoneFocus, stats: {}, findings: [] }
  const stats = currentZoneData.stats
  const arr   = currentZoneData.findings

  // Page count
  const findingPageCount = Math.max(1, Math.ceil(arr.length / ROWS_PER_PAGE))
  const totalPages       = 2 + findingPageCount

  // Build HTML for each page
  const htmlPages = [
    buildPage1(stats, arr, zoneFocus, allZoneData),
    buildPage2(stats, arr),
    ...Array.from({ length: findingPageCount }, (_, i) =>
      buildFindingsPage(arr, i * ROWS_PER_PAGE, 3 + i, totalPages)
    ),
  ]

  // Capture all pages concurrently
  const canvases = await Promise.all(htmlPages.map(h => captureHtml(h, html2canvas)))

  // Assemble PDF
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const A4_W  = 210
  const A4_H  = 297

  canvases.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage()
    const imgData = canvas.toDataURL('image/jpeg', 0.93)
    const imgH    = (canvas.height / canvas.width) * A4_W
    if (imgH <= A4_H) {
      doc.addImage(imgData, 'JPEG', 0, 0, A4_W, imgH)
    } else {
      // Scale to fit height
      const scale = A4_H / imgH
      doc.addImage(imgData, 'JPEG', 0, 0, A4_W * scale, A4_H)
    }
  })

  const dateStr = new Date().toISOString().slice(0, 10)
  doc.save(`traffic-safety-report-${dateStr}.pdf`)
}
