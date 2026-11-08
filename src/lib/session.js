/*
 * Data sesi photobooth (template terpilih & foto) disimpan di sessionStorage
 * supaya tidak hilang saat pindah halaman / refresh, dan otomatis bersih
 * saat tab ditutup. Semua akses dibungkus try/catch karena storage bisa
 * diblokir (mode privat, dsb).
 */
import { TEMPLATES, PRINT } from '../data/templates.js'
import { getKiosk } from './kiosk.js'

const KEY_TEMPLATE = 'photobooth.template'
const KEY_SHOTS = 'photobooth.shots'
const KEY_RECEIPT = 'photobooth.receipt'
const KEY_SESSION_ID = 'photobooth.sessionId'
// localStorage: nomor struk terus naik per kiosk (A, B, …)
const counterKey = (code) => (code ? `photobooth.counter.${code}` : 'photobooth.counter')

function read(key) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    if (value == null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    /* storage penuh / diblokir: abaikan */
  }
}

export function getTemplateId() {
  const id = read(KEY_TEMPLATE)
  return TEMPLATES.some((t) => t.id === id) ? id : null
}

export function setTemplateId(id) {
  write(KEY_TEMPLATE, id)
}

export function getShots() {
  try {
    const arr = JSON.parse(read(KEY_SHOTS))
    if (Array.isArray(arr) && arr.length === PRINT.photosPerStrip) return arr
  } catch {
    /* data rusak */
  }
  return Array(PRINT.photosPerStrip).fill(null)
}

export function setShots(shots) {
  write(KEY_SHOTS, JSON.stringify(shots))
}

/*
 * ID sesi softfile: 10 karakter acak (huruf/angka), dipakai di link QR
 * (/s/<id>). Dibuat saat pertama dibutuhkan, berlaku sampai sesi dihapus.
 */
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function peekSessionId() {
  return read(KEY_SESSION_ID)
}

export function getSessionId() {
  let id = peekSessionId()
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(10))
    id = Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('')
    write(KEY_SESSION_ID, id)
  }
  return id
}

/*
 * Nomor struk, tanggal & jam. Dibuat sekali per sesi (saat foto pertama
 * diunggah / halaman hasil dibuka) supaya tidak berubah ketika di-refresh.
 * Dengan kiosk terdaftar: CA-A0001 (huruf kiosk + hitungan kiosk itu),
 * sehingga nomor tidak bentrok antar tablet.
 */
export function getReceiptMeta() {
  try {
    const saved = JSON.parse(read(KEY_RECEIPT))
    if (saved?.no) return saved
  } catch {
    /* data rusak: buat baru */
  }
  const code = getKiosk()?.code || ''
  let counter = 1
  try {
    counter = (Number(localStorage.getItem(counterKey(code))) || 0) + 1
    localStorage.setItem(counterKey(code), String(counter))
  } catch {
    counter = Math.floor(Math.random() * 9000) + 1000
  }
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const meta = {
    no: `CA-${code}${String(counter).padStart(4, '0')}`,
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
  write(KEY_RECEIPT, JSON.stringify(meta))
  return meta
}

// Lanjutkan hitungan nomor struk dari server (dipakai halaman /setup),
// supaya nomor tidak mengulang kalau data tablet sempat terhapus.
export function syncReceiptCounter(code, lastReceiptNo) {
  const n = Number(String(lastReceiptNo || '').replace(/^CA-[A-Z]/, '')) || 0
  try {
    const cur = Number(localStorage.getItem(counterKey(code))) || 0
    if (n > cur) localStorage.setItem(counterKey(code), String(n))
  } catch {
    /* abaikan */
  }
}

// Gambar struk (JPEG data URL) untuk diunggah ulang bila halaman di-refresh.
const KEY_RECEIPT_IMG = 'photobooth.receiptImage'
export const getReceiptImage = () => read(KEY_RECEIPT_IMG)
export const setReceiptImage = (dataUrl) => write(KEY_RECEIPT_IMG, dataUrl)

// Sesi selesai: hapus foto, struk, template, dan ID sesi.
export function clearSession() {
  write(KEY_SHOTS, null)
  write(KEY_RECEIPT, null)
  write(KEY_RECEIPT_IMG, null)
  write(KEY_TEMPLATE, null)
  write(KEY_SESSION_ID, null)
}
