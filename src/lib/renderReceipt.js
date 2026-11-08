/*
 * Menggambar struk final dalam resolusi asli printer thermal 58 mm:
 * lebar 384 titik (48 mm @ 203 dpi), hanya hitam & putih.
 * Hasil canvas ini dipakai untuk pratinjau, unduhan, dan cetak, jadi
 * yang terlihat di layar = yang keluar dari printer.
 */
import { EVENT } from '../data/packages.js'
import { CASHIER, PRINT } from '../data/templates.js'
import { barcodeBars, qrCells } from './codes.js'
import { normalizePrintSettings } from './printSettings.js'

const W = PRINT.widthDots // 384
const PAD = 6
const MONO = '"Space Mono", "Courier New", monospace'
const HAND = '"Caveat Brush", cursive'
const FS = 19 // ukuran huruf dasar: ±32 karakter per baris

const PATH = {
  tree: 'M0,-11 L-6,-2 H-3 L-9,6 H9 L3,-2 H6Z M0,6 V11',
  star: 'M0,-11 L3,-3.5 L11,-3.5 L4.6,1.6 L7,9.5 L0,4.8 L-7,9.5 L-4.6,1.6 L-11,-3.5 L-3,-3.5Z',
  hatTop: 'M12,46 C16,24 32,8 54,10 C66,11 72,20 72,30',
  hatBrim: 'M6,46 C26,40 44,40 64,46 C62,51 62,54 64,58 C44,52 26,52 6,58 C8,54 8,50 6,46Z',
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`400 ${FS}px "Space Mono"`),
      document.fonts.load(`700 ${FS}px "Space Mono"`),
      document.fonts.load('64px "Caveat Brush"'),
    ])
  } catch {
    /* font gagal dimuat: pakai font cadangan */
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Foto dari storage (domain lain) perlu CORS supaya bisa diolah di canvas.
    if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/*
 * Olah foto untuk printer thermal sesuai pengaturan dari panel admin:
 *  - terang, kontras, gamma → atur nada abu-abu
 *  - mode gray      : kirim abu-abu, printer yang mengubah ke titik
 *  - mode dither    : titik-titik Atkinson (membuang sebagian error, jadi
 *                     lebih terang & kontras; cocok untuk thermal yang gelap)
 *  - mode threshold : hitam/putih tegas berdasarkan nilai ambang
 */
export function processPhoto(img, w, h, settings) {
  const { mode, contrast, brightness, gamma, threshold } = normalizePrintSettings(settings)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, w, h)
  const data = x.getImageData(0, 0, w, h)
  const px = data.data
  const g = new Float32Array(w * h)

  for (let i = 0; i < w * h; i++) {
    let v = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255
    v = ((v - 0.5) * contrast + 0.5) * brightness
    v = Math.min(1, Math.max(0, v)) ** gamma
    g[i] = v * 255
  }

  if (mode === 'dither') atkinson(g, w, h)

  for (let i = 0; i < w * h; i++) {
    const v = mode === 'gray' ? Math.round(g[i]) : g[i] < (mode === 'threshold' ? threshold : 128) ? 0 : 255
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v
    px[i * 4 + 3] = 255
  }
  x.putImageData(data, 0, 0)
  return c
}

function atkinson(g, w, h) {
  const spread = [
    [1, 0],
    [2, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 2],
  ]
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx
      const old = g[i]
      const val = old < 128 ? 0 : 255
      const err = (old - val) / 8
      g[i] = val
      for (const [dx, dy] of spread) {
        const nx = xx + dx
        const ny = yy + dy
        if (nx >= 0 && nx < w && ny < h) g[ny * w + nx] += err
      }
    }
  }
}

/*
 * print = pengaturan cetak → versi untuk printer (foto diolah).
 * print = null           → versi layar & softfile (foto asli).
 */
export async function renderReceipt({ template: t, photos, meta, print = null }) {
  await loadFonts()
  const images = await Promise.all(photos.map(loadImage))

  // Kanvas tinggi sementara, nanti dipotong sesuai isi.
  const tall = document.createElement('canvas')
  tall.width = W
  tall.height = 4000
  const ctx = tall.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, tall.height)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  let y = 14

  const setFont = (size, weight = 400, family = MONO) => {
    ctx.font = `${weight} ${size}px ${family}`
  }

  const center = (text, { size = FS, weight = 400, family = MONO, gap = 0.35, spacing = 0 } = {}) => {
    setFont(size, weight, family)
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
    ctx.textAlign = 'center'
    y += size
    ctx.fillText(text, W / 2 + spacing / 2, y)
    y += size * gap
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  }

  const line = (left, right) => {
    setFont(FS)
    y += FS
    ctx.textAlign = 'left'
    ctx.fillText(left, PAD, y)
    ctx.textAlign = 'right'
    ctx.fillText(right, W - PAD, y)
    y += FS * 0.4
  }

  const leader = (left, right) => {
    setFont(FS)
    y += FS
    ctx.textAlign = 'left'
    ctx.fillText(left, PAD, y)
    ctx.textAlign = 'right'
    ctx.fillText(right, W - PAD, y)
    const x1 = PAD + ctx.measureText(left).width + 8
    const x2 = W - PAD - ctx.measureText(right).width - 8
    ctx.save()
    ctx.setLineDash([2, 4])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y - 3)
    ctx.lineTo(x2, y - 3)
    ctx.stroke()
    ctx.restore()
    y += FS * 0.4
  }

  const rule = (double = false) => {
    y += 10
    ctx.save()
    ctx.lineWidth = 2
    if (!double) ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    if (double) {
      ctx.moveTo(PAD, y + 5)
      ctx.lineTo(W - PAD, y + 5)
      y += 5
    }
    ctx.stroke()
    ctx.restore()
    y += 10
  }

  const icon = (d, cx, cy, scale, { fill = false, width = 1.6 } = {}) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.lineWidth = width
    const p = new Path2D(d)
    if (fill) ctx.fill(p)
    ctx.stroke(p)
    ctx.restore()
  }

  /* ---------- Kop ---------- */
  const title = EVENT.title.toUpperCase()
  if (t.header === 'xmas') {
    y += 22
    icon(PATH.tree, W / 2 - 64, y, 1.9)
    icon(PATH.star, W / 2, y - 4, 2.4)
    icon(PATH.tree, W / 2 + 64, y, 1.9)
    y += 24
  }
  if (t.header === 'stars') {
    center('*'.repeat(32), { size: FS, gap: 0.1 })
    center(title, { size: 42, weight: 700, gap: 0.15 })
    center('******** PHOTOBOOTH *********', { size: FS })
  } else if (t.header === 'hand') {
    // topi Santa di kiri atas tulisan tangan
    ctx.save()
    ctx.translate(PAD + 14, y + 6)
    ctx.rotate((-18 * Math.PI) / 180)
    ctx.scale(0.85, 0.85)
    ctx.lineWidth = 5
    ctx.fillStyle = '#fff'
    for (const d of [PATH.hatTop, PATH.hatBrim]) {
      const p = new Path2D(d)
      ctx.fill(p)
      ctx.stroke(p)
    }
    ctx.beginPath()
    ctx.arc(72, 37, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = '#000'

    ctx.save()
    y += 16
    ctx.translate(W / 2, y + 50)
    ctx.rotate((-3 * Math.PI) / 180)
    setFont(66, 400, HAND)
    ctx.textAlign = 'center'
    ctx.fillText(EVENT.title, 0, 0)
    ctx.restore()
    y += 62
    center('PHOTOBOOTH', { size: 16, weight: 700, spacing: 6 })
  } else {
    center(title, { size: 46, weight: 700, gap: 0.1 })
    center('PHOTOBOOTH', { size: 16, weight: 700, spacing: 6 })
  }

  y += 4
  center('Bethel Teens & Youth', { size: FS, gap: 0.15 })
  center(EVENT.subtitle, { size: FS, gap: 0.1 })

  rule()
  line(`No: ${meta.no}`, meta.date)
  line(`Kasir: ${CASHIER}`, meta.time)
  rule()

  /* ---------- Foto ---------- */
  const photoW = W - PAD * 2 - 4
  const photoH = Math.round(photoW / PRINT.photoAspect)
  images.forEach((img, i) => {
    y += 4
    if (print) {
      ctx.drawImage(processPhoto(img, photoW, photoH, print), PAD + 2, y)
    } else {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, PAD + 2, y, photoW, photoH)
    }
    ctx.lineWidth = 2
    ctx.strokeRect(PAD + 1, y - 1, photoW + 2, photoH + 2)
    y += photoH + 2
    leader(`${t.item} #${i + 1}`, '1x')
    y += 6
  })

  /* ---------- Total ---------- */
  rule()
  t.totals.forEach(([l, r]) => line(l, r))
  rule(true)

  /* ---------- Barcode / QR ---------- */
  y += 8
  if (t.code === 'qr') {
    const { n, cells, finders } = qrCells(t.id)
    const mod = 6
    const size = n * mod
    const x0 = Math.round((W - size) / 2)
    for (const [cx, cy] of cells) ctx.fillRect(x0 + cx * mod, y + cy * mod, mod, mod)
    for (const [fx, fy] of finders) {
      ctx.lineWidth = mod
      ctx.strokeRect(x0 + fx * mod + mod / 2, y + fy * mod + mod / 2, mod * 6, mod * 6)
      ctx.fillRect(x0 + (fx + 2) * mod, y + (fy + 2) * mod, mod * 3, mod * 3)
    }
    y += size + 6
  } else {
    const bw = 300
    const scale = bw / 96
    const x0 = (W - bw) / 2
    for (const { x, w } of barcodeBars(t.id)) ctx.fillRect(Math.round(x0 + x * scale), y, Math.max(2, Math.round(w * scale)), 64)
    y += 64
    center(`${meta.no.replace('-', '')}${meta.date.replaceAll('/', '').slice(0, 4)}`, { size: 15, spacing: 4, gap: 0.2 })
  }

  /* ---------- Penutup ---------- */
  y += 4
  t.footer.forEach((f) => center(f, { size: FS, weight: 700, gap: 0.2 }))
  y += 28

  const out = document.createElement('canvas')
  out.width = W
  out.height = Math.ceil(y)
  out.getContext('2d').drawImage(tall, 0, 0)
  return out
}
