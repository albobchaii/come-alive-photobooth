import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { renderReceipt } from '../lib/renderReceipt.js'
import { getReceiptMeta, getShots, getTemplateId, setReceiptImage } from '../lib/session.js'
import { uploadReceipt } from '../lib/softfile.js'
import { refreshPrintSettings } from '../lib/printConfig.js'
import { TEMPLATES } from '../data/templates.js'
import CancelButton from '../components/CancelButton.jsx'
import PrintArea from '../components/PrintArea.jsx'

export default function ResultPage() {
  const navigate = useNavigate()
  const template = TEMPLATES.find((t) => t.id === getTemplateId())
  const shots = useMemo(getShots, [])
  const complete = shots.every(Boolean)
  const meta = useMemo(() => (template && complete ? getReceiptMeta() : null), [template, complete])

  const [image, setImage] = useState(null) // versi layar: { url, width, height }
  const [printImage, setPrintImage] = useState(null) // versi printer (foto diolah)
  const [feedMm, setFeedMm] = useState(15)
  const [error, setError] = useState('')
  const [printed, setPrinted] = useState(false)

  useEffect(() => {
    if (!template || !complete) return
    let alive = true
    renderReceipt({ template, photos: shots, meta })
      .then((canvas) => {
        if (!alive) return
        setImage({ url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height })
        // Softfile: struk versi JPEG (±4x lebih kecil dari PNG) langsung diunggah.
        const jpeg = canvas.toDataURL('image/jpeg', 0.85)
        setReceiptImage(jpeg)
        canvas.toBlob((blob) => uploadReceipt(blob), 'image/jpeg', 0.85)
      })
      .catch(() => alive && setError('Could not create the receipt. Tap Cancel and try again.'))
    return () => {
      alive = false
    }
  }, [template, complete, shots, meta])

  // Versi untuk printer: foto diolah sesuai pengaturan dari panel admin.
  useEffect(() => {
    if (!template || !complete) return
    let alive = true
    refreshPrintSettings()
      .then((print) => {
        if (alive) setFeedMm(print.feedMm)
        return renderReceipt({ template, photos: shots, meta, print })
      })
      .then((canvas) => {
        if (alive) setPrintImage({ url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height })
      })
      .catch(() => alive && setError('Could not create the receipt. Tap Cancel and try again.'))
    return () => {
      alive = false
    }
  }, [template, complete, shots, meta])

  useEffect(() => {
    const onAfterPrint = () => setPrinted(true)
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  if (!template) return <Navigate to="/template" replace />
  if (!complete) return <Navigate to="/booth" replace />

  // Cetak struk, lalu pindah ke halaman QR softfile.
  // Chrome menahan window.print() sampai dialog ditutup; browser lain tidak,
  // jadi tunggu event 'afterprint' dengan cadangan waktu.
  const printAndShowQr = () => {
    let moved = false
    const go = () => {
      if (moved) return
      moved = true
      window.removeEventListener('afterprint', go)
      navigate('/softfile')
    }
    window.addEventListener('afterprint', go)
    window.print()
    setTimeout(go, 1500)
  }

  return (
    <>
      <main className="page page--result no-print">
        <header className="topbar">
          <CancelButton />
          <span className="topbar__brand">Come Alive PhotoBooth</span>
          <span className="topbar__step">3 / 3</span>
        </header>

        <div className="result">
          <section className="result__panel">
            <h1 className="result__title">{printed ? 'Grab your receipt!' : 'Your Receipt Is Ready!'}</h1>
            <p className="result__meta">
              <span>{meta.no}</span>
              <span aria-hidden="true">·</span>
              <span>{template.name}</span>
            </p>
            <p className="result__note">
              {printed
                ? 'Printing now. Pick it up from the printer 🎄'
                : 'Ready to print on 58 mm thermal paper.'}
            </p>

            <div className="result__actions">
              <button type="button" className="cta" onClick={printAndShowQr} disabled={!printImage}>
                {printed ? 'Print Again' : 'Print Receipt'}
              </button>
            </div>
          </section>

          <section className="result__receipt" aria-label="Receipt preview">
            <div className="tpl tpl--result">
              <div className="tpl__paper">
                {image ? (
                  <img src={image.url} alt={`Photo receipt ${meta.no}`} className="result__img" />
                ) : (
                  <div className="result__loading">{error || 'Preparing receipt…'}</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Hanya muncul saat dicetak */}
      <PrintArea image={printImage} feedMm={feedMm} />
    </>
  )
}
