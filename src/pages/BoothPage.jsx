import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import useCamera, { captureFrame } from '../lib/useCamera.js'
import { getShots, getTemplateId, setShots as saveShots } from '../lib/session.js'
import { uploadPhoto } from '../lib/softfile.js'
import { PRINT, TEMPLATES } from '../data/templates.js'
import CancelButton from '../components/CancelButton.jsx'

const COUNTDOWN = 3 // detik sebelum tiap jepretan
const PAUSE_AFTER_SHOT = 1300 // ms jeda setelah jepretan sebelum foto berikutnya

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export default function BoothPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const templateId = state?.templateId ?? getTemplateId()
  const template = TEMPLATES.find((t) => t.id === templateId)

  const { videoRef, status, error, retry } = useCamera()
  const [shots, setShots] = useState(getShots)
  const [shooting, setShooting] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [count, setCount] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  useEffect(() => saveShots(shots), [shots])

  const total = PRINT.photosPerStrip
  const taken = shots.filter(Boolean).length
  const done = taken === total

  // Jalankan sesi foto untuk slot-slot tertentu (semua, atau yang belum terisi).
  const runSequence = useCallback(
    async (indices) => {
      setShooting(true)
      for (const i of indices) {
        setActiveIndex(i)
        for (let n = COUNTDOWN; n > 0; n--) {
          if (cancelled.current) return
          setCount(n)
          await wait(1000)
        }
        if (cancelled.current) return
        setCount(0)
        const photo = captureFrame(videoRef.current, PRINT.photoAspect)
        setFlashKey((k) => k + 1)
        setShots((prev) => prev.map((p, j) => (j === i ? photo : p)))
        // Langsung kirim ke server di latar belakang (softfile siap lebih cepat).
        uploadPhoto(i, photo)
        await wait(PAUSE_AFTER_SHOT)
      }
      if (cancelled.current) return
      setActiveIndex(-1)
      setShooting(false)
    },
    [videoRef],
  )

  const startAll = () => {
    setShots(Array(total).fill(null))
    runSequence([...Array(total).keys()])
  }

  const continueMissing = () => runSequence(shots.flatMap((p, i) => (p ? [] : [i])))

  if (!template) return <Navigate to="/template" replace />

  const canShoot = status === 'ready' && !shooting

  return (
    <main className="page page--booth">
      <header className="topbar">
        <CancelButton />
        <span className="topbar__brand">Come Alive PhotoBooth</span>
        <span className="topbar__step">2 / 3</span>
      </header>

      <div className="booth">
        <section className="booth__main">
          <div className={`cam${shooting ? ' is-shooting' : ''}`} style={{ aspectRatio: PRINT.photoAspect }}>
            <video ref={videoRef} className="cam__video" playsInline muted autoPlay />

            {status === 'loading' && (
              <div className="cam__overlay">
                <p className="cam__msg">Starting camera…</p>
              </div>
            )}

            {status === 'error' && (
              <div className="cam__overlay cam__overlay--solid">
                <p className="cam__msg">{error}</p>
                <button type="button" className="back" onClick={retry}>
                  Try again
                </button>
              </div>
            )}

            {count > 0 && (
              <div className="cam__count" key={`${activeIndex}-${count}`} aria-live="assertive">
                {count}
              </div>
            )}

            {shooting && (
              <div className="cam__badge">
                {template.item} #{activeIndex + 1} of {total}
              </div>
            )}

            {flashKey > 0 && <div className="cam__flash" key={flashKey} />}
          </div>

          {/* Thumbnail 3 foto di bawah kamera */}
          <div className="thumbs" aria-label="Photos taken">
            {shots.map((p, i) => (
              <div
                key={i}
                className={`thumb${p ? ' has-photo' : ''}${i === activeIndex ? ' is-active' : ''}`}
                aria-label={p ? `${template.item} #${i + 1}` : `${template.item} #${i + 1} not taken yet`}
              >
                {p ? <img src={p} alt="" /> : <span>{i + 1}</span>}
              </div>
            ))}
          </div>

          <div className="booth__actions">
            {!done && (
              <button
                type="button"
                className="cta"
                onClick={taken === 0 ? startAll : continueMissing}
                disabled={!canShoot}
              >
                {shooting ? 'Smile!' : taken === 0 ? 'Start' : 'Continue'}
              </button>
            )}
            {done && !shooting && (
              <button
                type="button"
                className="cta"
                onClick={() => navigate('/hasil', { state: { templateId } })}
              >
                Next
              </button>
            )}
          </div>

          <p className="booth__hint">
            {done && !shooting
              ? 'All photos taken! Tap Next to continue.'
              : `${total} photos, ${COUNTDOWN}-second countdown before each one.`}
          </p>
        </section>

      </div>
    </main>
  )
}
