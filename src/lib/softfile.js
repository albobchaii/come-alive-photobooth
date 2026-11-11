/*
 * Softfile: upload foto ke server supaya bisa diunduh pengunjung lewat QR.
 *
 * Alur (supaya tidak ada delay saat QR di-scan):
 *  1. Foto #1 diambil  → sesi didaftarkan + foto-1.jpg langsung diunggah
 *  2. Foto #2, #3      → diunggah selama hitung mundur foto berikutnya
 *  3. Halaman cetak    → struk.jpg diunggah begitu struk selesai digambar
 *  4. Halaman QR       → "complete": server cek 4 file lalu tandai siap
 *
 * Foto softfile diberi film grade Come Alive dulu (filmGrade.js); struk tidak.
 *
 * Upload berjalan di latar belakang dan terus dicoba ulang (internet putus,
 * link kedaluwarsa, dsb.), juga setelah pengunjung menekan Selesai.
 * Foto ulang cukup mengunggah ulang file yang sama (menimpa).
 */
import { getKiosk, kioskFetch } from './kiosk.js'
import { getReceiptMeta, getSessionId, getTemplateId } from './session.js'
import { gradeForSoftfile } from './filmGrade.js'

export const SOFTFILE_FILES = ['foto-1.jpg', 'foto-2.jpg', 'foto-3.jpg', 'struk.jpg']

// Link di QR. Bisa diarahkan ke domain lain lewat VITE_PUBLIC_BASE_URL.
export function softfileUrl(id) {
  const base = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/+$/, '')
  return `${base}/s/${id}`
}

export const softfileEnabled = () => Boolean(getKiosk())

/* ------------------------------------------------------------------ */

const engines = new Map() // id sesi → status upload
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const backoff = (n) => Math.min(15_000, 1000 * 2 ** Math.min(n, 4))

class Stop extends Error {}

function engineFor(id) {
  let e = engines.get(id)
  if (!e) {
    e = {
      id,
      receiptNo: null,
      templateId: null,
      targets: null, // { files: {nama: {url, method, headers}}, expiresAt }
      registering: null,
      blobs: {}, // file terakhir per nama (untuk upload ulang)
      versions: {},
      running: {},
      done: new Set(),
      status: 'idle', // idle | uploading | ready | error
      completing: null,
      grading: {}, // nama file → proses film grade yang belum selesai
      cancelled: false,
      listeners: new Set(),
    }
    engines.set(id, e)
  }
  return e
}

function emit(e) {
  const snap = snapshot(e)
  e.listeners.forEach((fn) => fn(snap))
}

const snapshot = (e) => ({ status: e.status, uploaded: e.done.size, total: SOFTFILE_FILES.length })

// Daftarkan sesi di server (aman diulang) dan ambil URL upload yang masih berlaku.
function register(e) {
  if (e.targets && e.targets.expiresAt - Date.now() > 5 * 60_000) return Promise.resolve(e.targets)
  if (!e.registering) {
    e.registering = (async () => {
      for (let n = 0; ; n++) {
        if (e.cancelled) throw new Stop('cancelled')
        try {
          const res = await kioskFetch('/api/sessions', {
            method: 'POST',
            body: { id: e.id, receiptNo: e.receiptNo, templateId: e.templateId },
          })
          if (res.ok) {
            e.targets = (await res.json()).uploads
            return e.targets
          }
          // Data/token salah → percuma diulang.
          if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new Stop(`register ${res.status}`)
        } catch (err) {
          if (err instanceof Stop) throw err
        }
        await sleep(backoff(n))
      }
    })().finally(() => {
      e.registering = null
    })
  }
  return e.registering
}

async function runUpload(e, name) {
  for (let n = 0; ; ) {
    if (e.cancelled) return
    const version = e.versions[name]
    try {
      const t = await register(e)
      const target = t.files[name]
      const res = await fetch(target.url, {
        method: target.method,
        headers: { ...target.headers, 'Content-Type': 'image/jpeg' },
        body: e.blobs[name],
      })
      if (res.ok) {
        // File diganti (foto ulang) selama upload → kirim versi terbaru.
        if (e.versions[name] !== version) continue
        e.done.add(name)
        emit(e)
        return
      }
      if (res.status === 413 || res.status === 415) throw new Stop(`upload ${res.status}`)
      // Link kedaluwarsa/ditolak → minta link baru lalu coba lagi.
      if (res.status >= 400 && res.status < 500) e.targets = null
    } catch (err) {
      if (err instanceof Stop) {
        e.status = 'error'
        emit(e)
        return
      }
    }
    await sleep(backoff(n++))
  }
}

function queue(e, name, blob) {
  e.blobs[name] = blob
  e.versions[name] = (e.versions[name] || 0) + 1
  e.done.delete(name)
  if (e.status !== 'ready') e.status = 'uploading'
  emit(e)
  if (!e.running[name]) {
    e.running[name] = runUpload(e, name).finally(() => {
      delete e.running[name]
    })
  }
  return e.running[name]
}

// Sesi aktif (dibuat bila belum ada). null bila kiosk belum di-setup.
function current() {
  if (!getKiosk()) return null
  const e = engineFor(getSessionId())
  if (!e.receiptNo) {
    e.receiptNo = getReceiptMeta().no
    e.templateId = getTemplateId()
  }
  return e
}

const toBlob = (dataUrl) => fetch(dataUrl).then((r) => r.blob())

/* ------------------------------------------------------------------ */
/* API untuk halaman                                                   */
/* ------------------------------------------------------------------ */

// Halaman kamera: tiap foto diberi film grade lalu diunggah.
export async function uploadPhoto(index, dataUrl) {
  const e = current()
  if (!e || !dataUrl) return
  const name = SOFTFILE_FILES[index]
  // Daftarkan sesi sekarang juga (jangan tunggu grade): kalau QR di-scan cepat,
  // pengunjung dapat halaman "almost ready", bukan "not found".
  register(e).catch(() => {})
  const job = toBlob(dataUrl).then(gradeForSoftfile)
  e.grading[name] = job
  const blob = await job
  // Foto diganti saat grade berjalan → hasil lama dibuang.
  if (e.grading[name] !== job) return
  delete e.grading[name]
  queue(e, name, blob)
}

// Halaman cetak: gambar struk (JPEG).
export function uploadReceipt(blob) {
  const e = current()
  if (e && blob) queue(e, 'struk.jpg', blob)
}

/*
 * Halaman QR: pastikan semua file terkirim lalu tandai siap.
 * `shots` & `receiptDataUrl` dari sessionStorage dipakai kalau halaman sempat
 * di-refresh sehingga file belum ada di memori.
 */
export function completeSoftfile({ shots = [], receiptDataUrl = null } = {}) {
  const e = current()
  if (!e) return Promise.resolve(false)
  if (e.completing) return e.completing

  e.completing = (async () => {
    // Tunggu film grade yang masih berjalan, supaya yang terkirim versi ber-grade.
    while (Object.keys(e.grading).length) await Promise.allSettled(Object.values(e.grading))
    // Isi file yang belum pernah diantrekan (mis. setelah refresh).
    for (const [i, shot] of shots.entries()) {
      const name = SOFTFILE_FILES[i]
      if (shot && !e.blobs[name]) queue(e, name, await gradeForSoftfile(await toBlob(shot)))
    }
    if (receiptDataUrl && !e.blobs['struk.jpg']) queue(e, 'struk.jpg', await toBlob(receiptDataUrl))

    for (let n = 0; ; n++) {
      if (e.cancelled) return false
      await Promise.allSettled(Object.values(e.running))
      if (e.status === 'error') return false
      try {
        await register(e)
        const res = await kioskFetch(`/api/sessions/${e.id}/complete`, { method: 'POST' })
        if (res.ok) {
          e.status = 'ready'
          emit(e)
          return true
        }
        if (res.status === 409) {
          const d = await res.json().catch(() => ({}))
          if (d.error !== 'files_missing') throw new Stop(d.error)
          // Server belum menerima file tertentu → kirim ulang.
          for (const name of d.missing || []) {
            if (!e.blobs[name]) throw new Stop(`missing ${name}`)
            queue(e, name, e.blobs[name])
          }
        } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Stop(`complete ${res.status}`)
        }
      } catch (err) {
        if (err instanceof Stop) {
          e.status = 'error'
          emit(e)
          return false
        }
      }
      await sleep(backoff(n))
    }
  })().finally(() => {
    if (e.status !== 'ready') e.completing = null
  })
  return e.completing
}

// Pantau status upload sesi aktif. Mengembalikan fungsi untuk berhenti.
export function watchSoftfile(fn) {
  const e = current()
  if (!e) return () => {}
  e.listeners.add(fn)
  fn(snapshot(e))
  return () => e.listeners.delete(fn)
}

// Batal: hentikan upload dan hapus sesi di server.
export async function cancelSoftfile(id) {
  if (!id || !getKiosk()) return
  const e = engines.get(id)
  if (e) {
    e.cancelled = true
    await e.registering?.catch(() => {})
  }
  for (let n = 0; n < 5; n++) {
    try {
      const res = await kioskFetch(`/api/sessions/${id}`, { method: 'DELETE', keepalive: true })
      if (res.ok || res.status === 404) return
    } catch {
      /* coba lagi */
    }
    await sleep(backoff(n))
  }
}

// Pengunjung baru menekan "Mulai Foto": batalkan sesi lama yang belum selesai
// (mis. ditinggal di tengah jalan). Sesi yang sudah siap/sedang selesai tidak disentuh.
export function abandonSoftfile(id) {
  const e = id && engines.get(id)
  if (e && e.status !== 'ready' && !e.completing) cancelSoftfile(id)
}
