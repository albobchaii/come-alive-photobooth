import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { completeSoftfile, softfileEnabled, softfileUrl, watchSoftfile } from '../lib/softfile.js'
import {
  clearSession,
  getReceiptImage,
  getReceiptMeta,
  getSessionId,
  getShots,
  getTemplateId,
} from '../lib/session.js'
import CancelButton from '../components/CancelButton.jsx'

const STEPS = ['Open your phone camera', 'Point it at the QR code', 'Save your photos']

// Link contoh untuk mode demo (tablet belum di-setup di /setup).
const DEMO_URL = 'https://comealive.example/foto'

function statusText(s, enabled) {
  if (!enabled) return 'Demo mode · tablet not set up'
  if (s.status === 'ready') return '✓ Photos ready to scan'
  if (s.status === 'error') return '⚠ Upload failed · please ask the crew'
  return `Uploading photos… ${s.uploaded}/${s.total}`
}

export default function SoftfilePage() {
  const navigate = useNavigate()
  const shots = useMemo(getShots, [])
  const ready = Boolean(getTemplateId()) && shots.every(Boolean)
  const meta = useMemo(() => (ready ? getReceiptMeta() : null), [ready])
  const enabled = softfileEnabled()
  const sessionId = useMemo(() => (ready && enabled ? getSessionId() : null), [ready, enabled])
  const link = sessionId ? softfileUrl(sessionId) : meta ? `${DEMO_URL}/${meta.no}` : ''

  const [qr, setQr] = useState(null) // data URL gambar QR
  const [error, setError] = useState('')
  const [upload, setUpload] = useState({ status: 'idle', uploaded: 0, total: 4 })

  // QR langsung tampil; upload diselesaikan di latar belakang.
  useEffect(() => {
    if (!link) return
    let alive = true
    QRCode.toDataURL(link, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 480,
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then((img) => alive && setQr(img))
      .catch(() => alive && setError('Could not create the QR code. Please try again.'))
    return () => {
      alive = false
    }
  }, [link])

  useEffect(() => {
    if (!sessionId) return
    const stop = watchSoftfile(setUpload)
    completeSoftfile({ shots, receiptDataUrl: getReceiptImage() })
    return stop
  }, [sessionId, shots])

  if (!ready) return <Navigate to="/" replace />

  const finish = () => {
    // Upload yang belum selesai tetap berjalan di latar belakang.
    clearSession()
    navigate('/')
  }

  return (
    <main className="page page--softfile">
      <header className="topbar">
        <CancelButton />
        <span className="topbar__brand">Come Alive PhotoBooth</span>
        <span className="topbar__step">Softfile</span>
      </header>

      <section className="softfile">
        <h1 className="softfile__title">Scan for Your Photos!</h1>
        <p className="softfile__sub">Your receipt is printing. While you wait, save the digital photos to your phone.</p>

        <div className="tpl tpl--qr">
          <div className="tpl__paper softfile__card">
            <div className="softfile__head">SOFTFILE · {meta.no}</div>
            <div className="softfile__qr">
              {qr ? (
                <img src={qr} alt={`QR code to download photos ${meta.no}`} />
              ) : (
                <span className="softfile__loading">{error || 'Preparing QR…'}</span>
              )}
            </div>
            <div className="softfile__foot">Scan to download photos</div>
          </div>
        </div>

        <p className={`softfile__status is-${enabled ? upload.status : 'demo'}`} aria-live="polite">
          {statusText(upload, enabled)}
        </p>

        <ol className="softfile__steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <span className="softfile__num">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        <button type="button" className="cta" onClick={finish}>
          Done
        </button>
      </section>
    </main>
  )
}
