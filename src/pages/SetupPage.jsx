/*
 * /setup — khusus panitia. Daftarkan tablet sebagai kiosk A–E dengan token
 * dari panel admin (scan QR setup) atau `npm run device -- add A "Kiosk A"`.
 * Disimpan di tablet ini saja.
 *
 * QR setup berisi /setup#token=… — token ada setelah tanda #, jadi tidak
 * pernah terkirim ke server sebagai bagian alamat.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearKiosk, getKiosk, kioskFetch, setKiosk } from '../lib/kiosk.js'
import { syncReceiptCounter } from '../lib/session.js'
import { refreshPrintSettings } from '../lib/printConfig.js'
import { PRINT_MODES } from '../lib/printSettings.js'
import { renderReceipt } from '../lib/renderReceipt.js'
import { testPhotos } from '../lib/testPhoto.js'
import { TEMPLATES } from '../data/templates.js'
import PrintArea from '../components/PrintArea.jsx'

const ERRORS = {
  401: 'Token tidak dikenal. Cek lagi token untuk kiosk ini.',
  403: 'Kiosk ini sedang dinonaktifkan panitia.',
  429: 'Terlalu banyak percobaan. Tunggu 1 menit.',
}

export default function SetupPage() {
  const [kiosk, setKioskState] = useState(getKiosk)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { ok, text }
  const [testPrint, setTestPrint] = useState(null) // { image, feedMm }

  // Token dari QR setup: isi otomatis lalu hapus dari alamat.
  useEffect(() => {
    const m = window.location.hash.match(/token=([\w-]+)/)
    if (m) {
      setToken(m[1])
      window.history.replaceState(null, '', window.location.pathname)
      setMsg({ ok: true, text: 'Token dari QR sudah terisi. Tekan Simpan.' })
    }
  }, [])

  // Cetak struk contoh dengan pengaturan cetak terbaru dari panel admin.
  const printTest = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const print = await refreshPrintSettings()
      const canvas = await renderReceipt({
        template: TEMPLATES[0],
        photos: testPhotos(),
        meta: { no: `UJI-${kiosk?.code || 'X'}`, date: new Date().toLocaleDateString('id-ID'), time: 'UJI' },
        print,
      })
      setTestPrint({
        image: { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height },
        feedMm: print.feedMm,
      })
      setMsg({ ok: true, text: `Mode: ${PRINT_MODES[print.mode]} · terang ${print.brightness} · kontras ${print.contrast}` })
      // tunggu gambar masuk ke area cetak dulu
      setTimeout(() => window.print(), 300)
    } catch {
      setMsg({ ok: false, text: 'Gagal membuat struk uji.' })
    } finally {
      setBusy(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    const t = token.trim()
    if (!t) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await kioskFetch('/api/devices/me', { token: t })
      if (!res.ok) throw new Error(ERRORS[res.status] || `Server menolak (${res.status}).`)
      const me = await res.json()
      const k = { code: me.code, name: me.name, token: t }
      if (!setKiosk(k)) throw new Error('Gagal menyimpan di tablet ini (penyimpanan diblokir).')
      syncReceiptCounter(me.code, me.lastReceiptNo)
      setKioskState(k)
      setToken('')
      setMsg({ ok: true, text: `Tersambung sebagai ${me.name}.` })
    } catch (err) {
      setMsg({ ok: false, text: err.message === 'Failed to fetch' ? 'Server tidak bisa dihubungi. Cek internet.' : err.message })
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await kioskFetch('/api/devices/me')
      if (!res.ok) throw new Error(ERRORS[res.status] || `Server menolak (${res.status}).`)
      const me = await res.json()
      syncReceiptCounter(me.code, me.lastReceiptNo)
      setMsg({ ok: true, text: `Server OK · nomor struk terakhir: ${me.lastReceiptNo || 'belum ada'}` })
    } catch (err) {
      setMsg({ ok: false, text: err.message === 'Failed to fetch' ? 'Server tidak bisa dihubungi. Cek internet.' : err.message })
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    clearKiosk()
    setKioskState(null)
    setMsg({ ok: true, text: 'Setup tablet dihapus. Photobooth kembali ke mode demo.' })
  }

  return (
    <>
      <main className="page page--setup no-print">
        <header className="topbar">
          <Link to="/" className="back">
            <span aria-hidden="true">←</span> Beranda
          </Link>
          <span className="topbar__brand">Come Alive PhotoBooth</span>
          <span className="topbar__step">Setup</span>
        </header>

        <section className="setup">
          <h1 className="setup__title">Setup Kiosk</h1>

          <div className="setup__card">
            <p className="setup__label">Tablet ini</p>
            {kiosk ? (
              <p className="setup__current">
                <span className="setup__code">{kiosk.code}</span> {kiosk.name}
              </p>
            ) : (
              <p className="setup__current setup__current--none">Belum di-setup (mode demo, tanpa softfile)</p>
            )}

            <form onSubmit={save} className="setup__form">
              <label htmlFor="token" className="setup__label">
                {kiosk ? 'Ganti token' : 'Token kiosk'}
              </label>
              <input
                id="token"
                className="setup__input"
                type="password"
                autoComplete="off"
                spellCheck="false"
                placeholder="ca_dev_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button type="submit" className="cta cta--sm" disabled={busy || !token.trim()}>
                {busy ? 'Mengecek…' : 'Simpan'}
              </button>
            </form>

            {kiosk && (
              <div className="setup__row">
                <button type="button" className="back" onClick={check} disabled={busy}>
                  Cek koneksi
                </button>
                <button type="button" className="back" onClick={printTest} disabled={busy}>
                  Cetak uji
                </button>
                <button type="button" className="back" onClick={reset} disabled={busy}>
                  Hapus setup
                </button>
              </div>
            )}

            {msg && <p className={`setup__msg${msg.ok ? '' : ' is-error'}`}>{msg.text}</p>}
          </div>

          <p className="setup__note">
            Token dibuat di panel admin (<code>/admin</code>): scan QR setup dari tablet ini. Setiap tablet memakai
            token sendiri.
          </p>
        </section>
      </main>
      <PrintArea image={testPrint?.image} feedMm={testPrint?.feedMm} />
    </>
  )
}
