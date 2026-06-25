import React, { useRef, useState, useCallback } from 'react'
import './UploadPage.css'

const PRELOADED_STREAMS = [
  {
    id: 'stream-1',
    filename: 'HOSP_ENG_CCTV_IngressLoop_MorningRush.mp4',
    duration: '02:40',
    description: 'Covers main ambulance staging ramp and spectator zebra lane crossover.',
  },
  {
    id: 'stream-2',
    filename: 'HOSP_ENG_CCTV_Dropoff_AfternoonStrollers.mov',
    duration: '03:15',
    description: 'Focuses on pedestrian speed table compliance and wheelchair curb ramps.',
  },
]

export default function UploadPage({ archivedClips, setArchivedClips, setActiveTab, onScanComplete }) {
  const fileInputRef     = useRef(null)
  const [dragging,       setDragging]      = useState(false)
  const [selectedStream, setSelectedStream] = useState(null)
  const [uploadedFile,   setUploadedFile]   = useState(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [scanProgress,   setScanProgress]   = useState(0)

  /* ── drag handlers ───────────────────────────── */
  const onDragOver  = useCallback(e => { e.preventDefault(); setDragging(true)  }, [])
  const onDragLeave = useCallback(()  => setDragging(false), [])

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) { setUploadedFile(file); setSelectedStream(null) }
  }, [])

  const handleBrowse    = () => fileInputRef.current?.click()
  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) { setUploadedFile(file); setSelectedStream(null) }
  }

  /* ── Start scanning ──────────────────────────── */
  const canScan = uploadedFile || selectedStream

  const handleStartScan = () => {
    if (!canScan || overlayVisible) return

    // Build the archive entry for when scan finishes
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const clip = uploadedFile
      ? { filename: uploadedFile.name, size: formatBytes(uploadedFile.size), date: now, duration: '—', faults: 0, status: 'Checked OK' }
      : { filename: selectedStream.filename, size: '342 MB', date: now, duration: selectedStream.duration, faults: 3, status: 'Checked OK' }

    // Fire upload to backend in background (don't block the UI)
    if (uploadedFile) {
      const form = new FormData()
      form.append('file', uploadedFile)
      fetch('/api/upload', { method: 'POST', body: form }).catch(() => {})
    }

    // Show 5-second overlay
    setOverlayVisible(true)
    setScanProgress(0)

    const DURATION = 5000
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const p = Math.min((elapsed / DURATION) * 100, 100)
      setScanProgress(p)
      if (p >= 100) {
        clearInterval(tick)
        // Store in archive, then navigate to dashboard
        setArchivedClips(prev => {
          const exists = prev.find(c => c.filename === clip.filename)
          return exists ? prev : [clip, ...prev]
        })
        setTimeout(() => {
          setOverlayVisible(false)
          setScanProgress(0)
          onScanComplete?.()
          setActiveTab('dashboard')
        }, 400)
      }
    }, 50)
  }

  /* ── Archive list (merge default + uploaded) ─── */
  const DEFAULT_CLIPS = [
    {
      filename: 'St_Jude_Trauma_Main_Loop_Mon_A_...',
      date:     '2026-06-15 09:12',
      duration: '04:15',
      size:     '342 MB',
      status:   'Checked OK',
    },
    {
      filename: 'RiyadhRing_Segment_C4_NightPatrol.mp4',
      date:     '2026-06-12 22:45',
      duration: '06:30',
      size:     '518 MB',
      status:   'Checked OK',
    },
    {
      filename: 'KAIA_AccessRoad_AM_Peak_Survey.mov',
      date:     '2026-06-10 07:20',
      duration: '03:55',
      size:     '289 MB',
      status:   'Checked OK',
    },
  ]
  const allClips = [...archivedClips, ...DEFAULT_CLIPS]

  return (
    <div className="upload-page">
      {/* ══════════════════════════════════════════
          LEFT COLUMN
         ══════════════════════════════════════════ */}
      <div className="upload-left">

        {/* ── Main processor panel ──────────────── */}
        <div className="processor-panel">
          <div className="processor-header">
            <div>
              <h2 className="processor-title">AI Video Safety Processor</h2>
              <p className="processor-subtitle">
                Import traffic feeds to trigger automatic safety audit calculations
              </p>
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`drop-zone${dragging ? ' drop-zone--active' : ''}${uploadedFile ? ' drop-zone--filled' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="upload-icon-circle">
              <UploadArrowIcon />
            </div>

            {uploadedFile ? (
              <>
                <p className="drop-title">{uploadedFile.name}</p>
                <p className="drop-sub">{formatBytes(uploadedFile.size)}</p>
                <button className="btn-browse" onClick={() => setUploadedFile(null)}>
                  Remove File
                </button>
              </>
            ) : (
              <>
                <p className="drop-title">Drag and Drop Safety Video file</p>
                <p className="drop-sub">Supports MP4, MOV, or AVI surveillance streams up to 1GB</p>
                <button className="btn-browse" onClick={handleBrowse}>
                  Browse Files
                </button>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/avi,.mp4,.mov,.avi"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
          </div>

          {/* Preloaded streams */}
          <div className="preloaded-section">
            <div className="preloaded-label">
              <LayersIcon />
              OR SELECT A PRELOADED CCTV STREAM (RECOMMENDED FOR EVALUATION)
            </div>
            <div className="stream-cards">
              {PRELOADED_STREAMS.map(stream => (
                <button
                  key={stream.id}
                  className={`stream-card${selectedStream?.id === stream.id ? ' stream-card--active' : ''}`}
                  onClick={() => {
                    setSelectedStream(stream)
                    setUploadedFile(null)
                  }}
                >
                  <div className="stream-card-top">
                    <span className="stream-filename">{stream.filename}</span>
                    <span className="stream-duration">{stream.duration}</span>
                  </div>
                  <p className="stream-desc">{stream.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Scan button */}
          <div className="scan-section">
            <button
              className={`btn-start-scan${canScan ? ' btn-start-scan--ready' : ''}`}
              onClick={handleStartScan}
              disabled={!canScan || overlayVisible}
            >
              <PlayIcon /> Start Traffic AI Scanning
            </button>
          </div>
        </div>

        {/* ── Info panel ────────────────────────── */}
        <div className="info-panel">
          <div className="info-heading">
            <InfoIcon />
            <span>How Traffic AI Computer Vision Safeguards Hospitals:</span>
          </div>
          <p className="info-body">
            This panel acts as your sensory intake. Local hospital managers feed dashboard DVR or
            live-recorded streams here. Our proprietary artificial intelligence detects speeders,
            blocks in ambulance bays, faded walkway lines, and stroller bottlenecks, adding
            findings automatically to public records.
          </p>
        </div>

      </div>

      {/* ══════════════════════════════════════════
          RIGHT COLUMN — Video Archive
         ══════════════════════════════════════════ */}
      <div className="upload-right">
        <div className="archive-panel">
          {/* Archive header */}
          <div className="archive-header">
            <div className="archive-title-row">
              <ClockIcon />
              <span className="archive-title">Video Archive</span>
            </div>
            <span className="clips-badge">{allClips.length} CLIP{allClips.length !== 1 ? 'S' : ''}</span>
          </div>

          {/* Clip list */}
          <div className="clip-list">
            {allClips.map((clip, idx) => (
              <div key={idx} className="clip-card">
                <div className="clip-card-top">
                  <span className="clip-filename" title={clip.filename}>
                    {clip.filename.length > 36
                      ? clip.filename.slice(0, 34) + '…'
                      : clip.filename}
                  </span>
                  <span className="clip-status-ok">
                    <CheckSmallIcon /> {clip.status}
                  </span>
                </div>
                <div className="clip-meta">
                  <span><CalendarIcon /> {clip.date}</span>
                  <span><ClockSmallIcon /> {clip.duration}</span>
                </div>
                <div className="clip-meta clip-meta--second">
                  <span><HddIcon /> {clip.size}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Full-screen scanning overlay ────────── */}
      {overlayVisible && (
        <ScanOverlay
          filename={uploadedFile ? uploadedFile.name : selectedStream?.filename}
          progress={scanProgress}
        />
      )}
    </div>
  )
}

/* ── Scanning overlay ────────────────────────── */
function getScanPhase(p) {
  if (p < 18) return 'Initializing AI Engine 4.0…'
  if (p < 36) return 'Extracting & Indexing Video Frames…'
  if (p < 55) return 'Running YOLO Object Detection…'
  if (p < 74) return 'Applying MOMAH Safety Ruleset…'
  if (p < 90) return 'Cross-referencing iRAP Standards…'
  return 'Generating Compliance Report…'
}

function ScanOverlay({ filename, progress }) {
  const phase = getScanPhase(progress)
  return (
    <div className="scan-overlay">
      <div className="scan-overlay-card">
        {/* Pulsing rings */}
        <div className="scan-anim-wrap">
          <div className="scan-ring scan-ring--1" />
          <div className="scan-ring scan-ring--2" />
          <div className="scan-anim-icon"><ScanBrainIcon /></div>
        </div>

        <div className="scan-overlay-title">AI SCANNING IN PROGRESS</div>
        <div className="scan-overlay-file">{filename}</div>
        <div className="scan-overlay-phase">{phase}</div>

        {/* Progress bar */}
        <div className="scan-overlay-track">
          <div
            className="scan-overlay-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="scan-overlay-pct">{Math.round(progress)}%</div>
        <div className="scan-overlay-hint">Redirecting to Platform Dashboard on completion…</div>
      </div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────── */
function formatBytes(bytes) {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb > 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

/* ── Icons ─────────────────────────────────── */
function UploadArrowIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}


function CheckSmallIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{flexShrink:0}}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8"  x2="12" y2="8.01" />
      <line x1="12" y1="12" x2="12" y2="16" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ClockSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}

function HddIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

function ScanBrainIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round">
      <path d="M12 2a5 5 0 0 1 5 5v1a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8V7a5 5 0 0 1 5-5z" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="9"  y1="14" x2="15" y2="14" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{flexShrink:0, marginTop:1}}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
