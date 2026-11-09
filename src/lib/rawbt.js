/*
 * Cetak langsung lewat aplikasi RawBT (Android) tanpa dialog cetak.
 *
 * Struk (gambar 384 titik) diubah jadi perintah printer thermal ESC/POS
 * (raster 1-bit, GS v 0), lalu dikirim ke RawBT lewat link intent:.
 * RawBT meneruskan byte itu apa adanya ke printer Bluetooth.
 *
 * Cara cetak dipilih per tablet di /setup dan disimpan di tablet itu.
 */
import { PRINT } from '../data/templates.js'

const KEY = 'photobooth.printMethod'

export const PRINT_METHODS = {
  dialog: 'Dialog cetak Android (pilih printer tiap kali)',
  rawbt: 'RawBT langsung (tanpa konfirmasi)',
}

export function getPrintMethod() {
  try {
    return localStorage.getItem(KEY) === 'rawbt' ? 'rawbt' : 'dialog'
  } catch {
    return 'dialog'
  }
}

export function setPrintMethod(method) {
  try {
    localStorage.setItem(KEY, method === 'rawbt' ? 'rawbt' : 'dialog')
  } catch {
    /* penyimpanan diblokir */
  }
}

const DOTS = PRINT.widthDots // 384
const BYTES_PER_ROW = DOTS / 8
const CHUNK_ROWS = 128 // kirim per potongan supaya buffer printer murah tidak penuh
const DOTS_PER_MM = 8

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Gambar → bit hitam/putih. Area abu-abu diubah jadi titik-titik (Floyd–Steinberg);
// gambar yang sudah hitam-putih (mode titik-titik/ambang di admin) tidak berubah.
function toBits(imageData) {
  const { width: w, height: h, data } = imageData
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255
    const l = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    lum[i] = l * a + 255 * (1 - a) // transparan = putih
  }
  const bits = new Uint8Array(BYTES_PER_ROW * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const old = lum[i]
      const black = old < 128
      const err = old - (black ? 0 : 255)
      if (black) bits[y * BYTES_PER_ROW + (x >> 3)] |= 0x80 >> (x & 7)
      if (x + 1 < w) lum[i + 1] += (err * 7) / 16
      if (y + 1 < h) {
        if (x > 0) lum[i + w - 1] += (err * 3) / 16
        lum[i + w] += (err * 5) / 16
        if (x + 1 < w) lum[i + w + 1] += err / 16
      }
    }
  }
  return bits
}

function escpos(bits, height, feedMm) {
  const out = [0x1b, 0x40] // ESC @ : reset printer
  for (let y0 = 0; y0 < height; y0 += CHUNK_ROWS) {
    const rows = Math.min(CHUNK_ROWS, height - y0)
    // GS v 0 m xL xH yL yH + data
    out.push(0x1d, 0x76, 0x30, 0x00, BYTES_PER_ROW & 0xff, BYTES_PER_ROW >> 8, rows & 0xff, rows >> 8)
    const slice = bits.subarray(y0 * BYTES_PER_ROW, (y0 + rows) * BYTES_PER_ROW)
    for (let i = 0; i < slice.length; i++) out.push(slice[i])
  }
  // Jarak sobek (printer tanpa pemotong): ESC J n = maju n titik (maks 255).
  let feed = Math.round(feedMm * DOTS_PER_MM)
  while (feed > 0) {
    const n = Math.min(255, feed)
    out.push(0x1b, 0x4a, n)
    feed -= n
  }
  return Uint8Array.from(out)
}

/** ImageData selebar 384 titik → byte ESC/POS siap cetak. */
export function escposFromImageData(imageData, feedMm = 15) {
  return escpos(toBits(imageData), imageData.height, feedMm)
}

function toBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Siapkan link RawBT dari gambar struk { url, width, height }. */
export async function buildRawbtUrl(image, feedMm = 15) {
  const img = await loadImage(image.url)
  const height = Math.round((img.height / img.width) * DOTS)
  const canvas = document.createElement('canvas')
  canvas.width = DOTS
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, DOTS, height)
  ctx.drawImage(img, 0, 0, DOTS, height)
  const bytes = escposFromImageData(ctx.getImageData(0, 0, DOTS, height), feedMm)
  return `intent:base64,${toBase64(bytes)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}

/** Link RawBT berisi teks pendek: cek apakah RawBT menerima kiriman dari website. */
export function rawbtTextUrl(text) {
  return `intent:${encodeURI(text)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}

/** Kirim ke RawBT. Panggil langsung dari tombol (butuh sentuhan pengguna). */
export function sendToRawbt(url) {
  window.location.href = url
}
