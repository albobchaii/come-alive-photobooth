/*
 * Film grade Come Alive untuk foto softfile (bukan untuk cetak thermal).
 *
 * Foto dikirim ke Web Worker satu per satu (grade di 2752 px butuh memori
 * besar, jadi jangan paralel). Kalau browser tidak mendukung, worker gagal,
 * atau terlalu lama, foto asli yang dipakai: softfile tidak boleh hilang
 * hanya karena efek gagal.
 */

// Stok yang dipakai: 'interior' (hangat, ruangan) atau 'exterior' (dingin, salju).
export const SOFTFILE_GRADE = 'interior'
const OUT_WIDTH = 1376 // setengah WORK_WIDTH (2752): turun 2:1 yang bersih
const QUALITY = 0.88
const TIMEOUT_MS = 45_000

let worker = null
let seq = 0
const pending = new Map()
let chain = Promise.resolve()

const supported = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined'

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./filmGrade.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id)
    if (!p) return
    pending.delete(data.id)
    data.blob ? p.resolve(data.blob) : p.reject(new Error(data.error))
  }
  // Worker mati (mis. kehabisan memori): gagalkan semua antrean, buat baru nanti.
  worker.onerror = (e) => {
    e.preventDefault?.()
    for (const p of pending.values()) p.reject(new Error('worker crashed'))
    pending.clear()
    worker.terminate()
    worker = null
  }
  return worker
}

function runOne(blob) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      // Worker macet: matikan supaya foto berikutnya dapat worker baru.
      worker?.terminate()
      worker = null
      reject(new Error('timeout'))
    }, TIMEOUT_MS)
    pending.set(id, {
      resolve: (b) => (clearTimeout(timer), resolve(b)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    })
    getWorker().postMessage({ id, blob, preset: SOFTFILE_GRADE, outWidth: OUT_WIDTH, quality: QUALITY })
  })
}

/** Foto (Blob JPEG) → foto ber-grade. Gagal apa pun → foto asli. */
export function gradeForSoftfile(blob) {
  if (!supported()) return Promise.resolve(blob)
  const job = chain.then(() => runOne(blob)).catch((err) => {
    console.warn('[film grade] pakai foto asli:', err?.message || err)
    return blob
  })
  chain = job
  return job
}
