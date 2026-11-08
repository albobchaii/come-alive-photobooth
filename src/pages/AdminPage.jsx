/*
 * /admin — panel panitia.
 *  - Kiosk       : tambah kiosk, ganti token (QR setup), aktif/nonaktif, status online
 *  - Hasil Cetak : atur terang/kontras/mode untuk printer thermal + pratinjau langsung
 * Dimuat terpisah (lazy) supaya tidak menambah berat aplikasi kiosk.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { TEMPLATES } from '../data/templates.js'
import { renderReceipt } from '../lib/renderReceipt.js'
import { testPhotos } from '../lib/testPhoto.js'
import PrintArea from '../components/PrintArea.jsx'
import {
  DEFAULT_PRINT_SETTINGS,
  DITHER_PRESET,
  PRINT_LIMITS,
  PRINT_MODES,
  normalizePrintSettings,
} from '../lib/printSettings.js'

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */
const ERR = {
  wrong_password: 'Password salah.',
  too_many_attempts: 'Terlalu banyak percobaan. Tunggu 15 menit.',
  admin_disabled: 'Panel admin belum aktif: isi ADMIN_PASSWORD (min. 12 karakter) di server.',
  code_taken: 'Kode kiosk itu sudah dipakai.',
  invalid_code: 'Kode kiosk harus 1 huruf A–Z.',
}

class LoggedOut extends Error {}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && data.error === 'admin_login_required') throw new LoggedOut()
  if (!res.ok) throw new Error(ERR[data.error] || `Gagal (${res.status}).`)
  return data
}

const timeAgo = (iso) => {
  if (!iso) return 'belum pernah'
  const s = Math.round((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.round(s / 60)} menit lalu`
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`
  return new Date(iso).toLocaleDateString('id-ID')
}

/* ------------------------------------------------------------------ */
/* Halaman                                                             */
/* ------------------------------------------------------------------ */
export default function AdminPage() {
  const [state, setState] = useState('loading') // loading | disabled | login | ready
  const [tab, setTab] = useState('kiosk')

  const check = useCallback(async () => {
    try {
      const me = await api('/me')
      setState(!me.enabled ? 'disabled' : me.loggedIn ? 'ready' : 'login')
    } catch {
      setState('login')
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  const onLoggedOut = useCallback(() => setState('login'), [])

  const logout = async () => {
    await api('/logout', { method: 'POST' }).catch(() => {})
    setState('login')
  }

  return (
    <main className="page page--admin no-print">
      <header className="topbar">
        <Link to="/" className="back">
          <span aria-hidden="true">←</span> Beranda
        </Link>
        <span className="topbar__brand">Come Alive PhotoBooth</span>
        {state === 'ready' ? (
          <button type="button" className="back topbar__end" onClick={logout}>
            Keluar
          </button>
        ) : (
          <span className="topbar__step">Admin</span>
        )}
      </header>

      <h1 className="admin__title">Panel Admin</h1>

      {state === 'loading' && <p className="admin__center">Memuat…</p>}
      {state === 'disabled' && <p className="admin__center">{ERR.admin_disabled}</p>}
      {state === 'login' && <LoginForm onDone={() => setState('ready')} />}
      {state === 'ready' && (
        <>
          <div className="admin__tabs" role="tablist">
            {[
              ['kiosk', 'Kiosk'],
              ['print', 'Hasil Cetak'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`admin__tab${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'kiosk' ? <KioskTab onLoggedOut={onLoggedOut} /> : <PrintTab onLoggedOut={onLoggedOut} />}
        </>
      )}
    </main>
  )
}

function LoginForm({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/login', { method: 'POST', body: { password } })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin__card admin__login" onSubmit={submit}>
      <label htmlFor="admin-pass" className="admin__label">
        Password admin
      </label>
      <input
        id="admin-pass"
        className="admin__input"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      <button type="submit" className="cta cta--sm" disabled={busy || !password}>
        {busy ? 'Masuk…' : 'Masuk'}
      </button>
      {error && <p className="admin__error">{error}</p>}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Tab Kiosk                                                           */
/* ------------------------------------------------------------------ */
function KioskTab({ onLoggedOut }) {
  const [devices, setDevices] = useState(null)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState(null) // { code, token, isNew }
  const [busy, setBusy] = useState(false)

  const guard = useCallback(
    async (fn) => {
      setError('')
      try {
        return await fn()
      } catch (err) {
        if (err instanceof LoggedOut) onLoggedOut()
        else setError(err.message)
      }
    },
    [onLoggedOut],
  )

  const load = useCallback(() => guard(async () => setDevices((await api('/devices')).devices)), [guard])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000) // status online diperbarui berkala
    return () => clearInterval(t)
  }, [load])

  const freeCodes = useMemo(() => {
    const used = new Set((devices || []).map((d) => d.code))
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => !used.has(c))
  }, [devices])

  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const code = newCode || freeCodes[0] || ''

  const add = (e) => {
    e.preventDefault()
    setBusy(true)
    guard(async () => {
      const r = await api('/devices', { method: 'POST', body: { code, name: newName || `Kiosk ${code}` } })
      setIssued({ code: r.code, token: r.token, isNew: true })
      setNewCode('')
      setNewName('')
      await load()
    }).finally(() => setBusy(false))
  }

  const rotate = (d) => {
    if (
      !window.confirm(
        `Ganti token ${d.name}?\n\nToken lama langsung tidak berlaku. Pastikan tablet lama tidak sedang mengunggah foto.`,
      )
    )
      return
    guard(async () => {
      const r = await api(`/devices/${d.code}/rotate`, { method: 'POST' })
      setIssued({ code: r.code, token: r.token, isNew: false })
    })
  }

  const toggle = (d) => {
    if (d.active && !window.confirm(`Nonaktifkan ${d.name}? Tablet itu tidak bisa mengirim foto sampai diaktifkan lagi.`))
      return
    guard(async () => {
      await api(`/devices/${d.code}`, { method: 'PATCH', body: { active: !d.active } })
      await load()
    })
  }

  return (
    <section className="admin__section">
      {error && <p className="admin__error">{error}</p>}

      <div className="admin__card">
        <h2 className="admin__h2">Daftar kiosk</h2>
        {!devices ? (
          <p>Memuat…</p>
        ) : !devices.length ? (
          <p>Belum ada kiosk. Tambahkan di bawah.</p>
        ) : (
          <ul className="kiosks">
            {devices.map((d) => (
              <li key={d.code} className={`kiosk${d.active ? '' : ' is-off'}`}>
                <span className="kiosk__code">{d.code}</span>
                <div className="kiosk__info">
                  <strong>{d.name}</strong>
                  <span className="kiosk__meta">
                    <span className={`dot${d.online && d.active ? ' is-on' : ''}`} aria-hidden="true" />
                    {!d.active ? 'Nonaktif' : d.online ? 'Online' : `Terakhir online ${timeAgo(d.lastSeen)}`}
                    {' · '}
                    {d.sessions24h} sesi (24 jam)
                    {d.hasOwnPrintSettings && ' · cetak khusus'}
                  </span>
                </div>
                <div className="kiosk__actions">
                  <button type="button" className="back" onClick={() => rotate(d)}>
                    Ganti token
                  </button>
                  <button type="button" className="back" onClick={() => toggle(d)}>
                    {d.active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="admin__card admin__add" onSubmit={add}>
        <h2 className="admin__h2">Tambah kiosk</h2>
        <div className="admin__row">
          <label className="admin__field">
            <span className="admin__label">Kode</span>
            <select className="admin__input" value={code} onChange={(e) => setNewCode(e.target.value)}>
              {freeCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="admin__field admin__field--grow">
            <span className="admin__label">Nama (opsional)</span>
            <input
              className="admin__input"
              maxLength={40}
              placeholder={`Kiosk ${code}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="cta cta--sm" disabled={busy || !code}>
          Tambah
        </button>
      </form>

      {issued && <TokenDialog {...issued} onClose={() => setIssued(null)} />}
    </section>
  )
}

// Token hanya tampil sekali: QR untuk discan tablet + teks untuk disalin.
function TokenDialog({ code, token, isNew, onClose }) {
  const [qr, setQr] = useState(null)
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/setup#token=${token}`

  useEffect(() => {
    QRCode.toDataURL(link, { errorCorrectionLevel: 'M', margin: 1, width: 360 }).then(setQr)
  }, [link])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const close = () => {
    if (window.confirm('Sudah dipindai/disalin? Token ini tidak bisa ditampilkan lagi.')) onClose()
  }

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="token-title">
      <div className="dialog__box">
        <h2 id="token-title" className="admin__h2">
          {isNew ? `Kiosk ${code} ditambahkan` : `Token baru Kiosk ${code}`}
        </h2>
        <p className="dialog__text">
          Scan QR ini dengan kamera <b>tablet {code}</b>, lalu tekan <b>Simpan</b> di halaman yang terbuka.
        </p>
        <div className="dialog__qr">{qr ? <img src={qr} alt="QR setup kiosk" /> : 'Membuat QR…'}</div>
        <code className="dialog__token">{token}</code>
        <div className="dialog__actions">
          <button type="button" className="back" onClick={copy}>
            {copied ? '✓ Tersalin' : 'Salin token'}
          </button>
          <button type="button" className="cta cta--sm" onClick={close}>
            Selesai
          </button>
        </div>
        <p className="dialog__warn">Token hanya tampil sekali. Jangan dibagikan ke selain panitia.</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tab Hasil Cetak                                                     */
/* ------------------------------------------------------------------ */
const SLIDERS = [
  ['brightness', 'Terang', 'Lebih besar = lebih terang'],
  ['contrast', 'Kontras', 'Lebih besar = beda gelap-terang lebih tegas'],
  ['gamma', 'Gamma', 'Lebih kecil = bagian tengah (kulit) lebih terang'],
  ['threshold', 'Ambang hitam', 'Lebih besar = lebih banyak bagian jadi hitam'],
  ['feedMm', 'Jarak sobek (mm)', 'Kertas kosong di akhir struk untuk disobek'],
]

function PrintTab({ onLoggedOut }) {
  const [data, setData] = useState(null) // { global, devices: {A: settings|null} }
  const [target, setTarget] = useState('global')
  const [draft, setDraft] = useState(null)
  const [own, setOwn] = useState(false) // kiosk punya pengaturan khusus?
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  const guard = useCallback(
    async (fn) => {
      setError('')
      try {
        return await fn()
      } catch (err) {
        if (err instanceof LoggedOut) onLoggedOut()
        else setError(err.message)
      }
    },
    [onLoggedOut],
  )

  const load = useCallback(() => guard(async () => setData(await api('/print-settings'))), [guard])
  useEffect(() => {
    load()
  }, [load])

  // Isi form sesuai target yang dipilih.
  useEffect(() => {
    if (!data) return
    if (target === 'global') {
      setDraft(data.global)
      setOwn(false)
    } else {
      const d = data.devices[target]
      setDraft(d || data.global)
      setOwn(Boolean(d))
    }
  }, [data, target])

  // Pesan "Tersimpan" hilang saat pindah target.
  useEffect(() => setSaved(''), [target])

  const original = !data ? null : target === 'global' ? data.global : data.devices[target] || data.global
  const dirty =
    draft && original && (JSON.stringify(draft) !== JSON.stringify(original) || (target !== 'global' && own !== Boolean(data.devices[target])))

  const set = (key, value) => {
    setDraft((d) => normalizePrintSettings({ ...d, [key]: value }))
    setSaved('')
  }

  const save = () =>
    guard(async () => {
      const settings = target === 'global' || own ? draft : null
      await api('/print-settings', { method: 'PUT', body: { target, settings } })
      await load()
      setSaved('Tersimpan. Tablet memakai pengaturan ini mulai sesi berikutnya.')
    })

  if (!data || !draft) return <p className="admin__center">{error || 'Memuat…'}</p>

  const editable = target === 'global' || own
  const kiosks = Object.keys(data.devices)

  return (
    <section className="admin__section admin__print">
      {error && <p className="admin__error">{error}</p>}

      <div className="admin__card print-controls">
        <label className="admin__field">
          <span className="admin__label">Berlaku untuk</span>
          <select className="admin__input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="global">Semua kiosk (umum)</option>
            {kiosks.map((c) => (
              <option key={c} value={c}>
                Kiosk {c}
                {data.devices[c] ? ' · khusus' : ''}
              </option>
            ))}
          </select>
        </label>

        {target !== 'global' && (
          <label className="admin__check">
            <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
            Pakai pengaturan khusus untuk Kiosk {target}
            {!own && <span className="admin__hint"> (sekarang ikut pengaturan umum)</span>}
          </label>
        )}

        <fieldset className="print-modes" disabled={!editable}>
          <legend className="admin__label">Mode foto</legend>
          {Object.entries(PRINT_MODES).map(([id, label]) => (
            <label key={id} className={`print-mode${draft.mode === id ? ' is-active' : ''}`}>
              <input type="radio" name="mode" value={id} checked={draft.mode === id} onChange={() => set('mode', id)} />
              {label}
            </label>
          ))}
        </fieldset>

        {SLIDERS.filter(([k]) => k !== 'threshold' || draft.mode === 'threshold').map(([key, label, hint]) => {
          const [min, max, step] = PRINT_LIMITS[key]
          return (
            <label key={key} className="slider">
              <span className="slider__top">
                <span className="admin__label">{label}</span>
                <output className="slider__val">{draft[key]}</output>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={draft[key]}
                disabled={!editable}
                onChange={(e) => set(key, e.target.value)}
              />
              <span className="admin__hint">{hint}</span>
            </label>
          )
        })}

        <div className="admin__row admin__row--wrap">
          <button type="button" className="back" disabled={!editable} onClick={() => setDraft(normalizePrintSettings({ ...draft, ...DITHER_PRESET }))}>
            Preset titik-titik
          </button>
          <button type="button" className="back" disabled={!editable} onClick={() => setDraft({ ...DEFAULT_PRINT_SETTINGS })}>
            Kembali ke awal
          </button>
        </div>

        <button type="button" className="cta cta--sm" onClick={save} disabled={!dirty}>
          Simpan
        </button>
        {saved && <p className="admin__ok">{saved}</p>}
        <p className="admin__hint">
          Kertas thermal biasanya lebih gelap dari layar. Setelah menyimpan, tekan <b>Cetak uji</b> di halaman{' '}
          <code>/setup</code> tablet untuk melihat hasil aslinya.
        </p>
      </div>

      <PrintPreview settings={draft} />
    </section>
  )
}

// Pratinjau struk untuk printer, dirender ulang tiap pengaturan berubah.
function PrintPreview({ settings }) {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [source, setSource] = useState('test') // test | last | file
  const [lastPhotos, setLastPhotos] = useState(null) // null = belum dicek, [] = tidak ada
  const [filePhotos, setFilePhotos] = useState([])
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  const sample = useMemo(testPhotos, [])
  const timer = useRef(0)

  useEffect(() => {
    api('/sample-photos')
      .then((d) => setLastPhotos(d.photos.length === 3 ? d.photos : []))
      .catch(() => setLastPhotos([]))
  }, [])

  // Foto dari perangkat admin: dibaca lokal saja, tidak diunggah.
  useEffect(() => () => filePhotos.forEach((u) => URL.revokeObjectURL(u)), [filePhotos])
  const pickFiles = (e) => {
    const files = [...e.target.files].slice(0, 3)
    if (!files.length) return
    const urls = files.map((f) => URL.createObjectURL(f))
    while (urls.length < 3) urls.push(urls[urls.length - 1])
    setFilePhotos(urls)
    setSource('file')
  }

  const photos = source === 'last' && lastPhotos?.length ? lastPhotos : source === 'file' && filePhotos.length ? filePhotos : sample

  useEffect(() => {
    clearTimeout(timer.current)
    let alive = true
    timer.current = setTimeout(() => {
      renderReceipt({
        template: TEMPLATES.find((t) => t.id === templateId),
        photos,
        meta: { no: 'CA-A0001', date: '24/12/2026', time: '19:30' },
        print: settings,
      })
        .then((c) => {
          if (alive) {
            setImage({ url: c.toDataURL('image/png'), width: c.width, height: c.height })
            setError('')
          }
        })
        .catch(() => alive && setError('Pratinjau gagal dibuat (foto tidak bisa dibuka).'))
    }, 150)
    return () => {
      alive = false
    }
  }, [settings, templateId, photos])

  return (
    <div className="admin__card print-preview">
      <div className="admin__row admin__row--wrap">
        <label className="admin__field">
          <span className="admin__label">Template</span>
          <select className="admin__input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin__field">
          <span className="admin__label">Foto contoh</span>
          <select className="admin__input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="test">Foto uji</option>
            <option value="last" disabled={!lastPhotos?.length}>
              Sesi terakhir{lastPhotos && !lastPhotos.length ? ' (belum ada)' : ''}
            </option>
            <option value="file" disabled={!filePhotos.length}>
              Dari perangkat ini
            </option>
          </select>
        </label>
        <label className="back admin__file">
          Pilih foto…
          <input type="file" accept="image/*" multiple onChange={pickFiles} />
        </label>
        <button type="button" className="cta cta--sm" disabled={!image} onClick={() => window.print()}>
          Cetak uji
        </button>
      </div>
      <p className="admin__hint">
        Pratinjau 1:1 seperti titik di printer (384 titik = 48 mm). <b>Cetak uji</b> memakai pengaturan di atas
        walau belum disimpan; perangkat ini harus tersambung ke printer.
      </p>
      <div className="print-preview__paper">
        {image ? <img src={image.url} alt="Pratinjau hasil cetak" /> : <p>{error || 'Membuat pratinjau…'}</p>}
      </div>
      {createPortal(<PrintArea image={image} feedMm={settings.feedMm} />, document.body)}
    </div>
  )
}
