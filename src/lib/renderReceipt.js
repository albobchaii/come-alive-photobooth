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
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif'

const PATH = {
  tree: 'M0,-11 L-6,-2 H-3 L-9,6 H9 L3,-2 H6Z M0,6 V11',
  star: 'M0,-11 L3,-3.5 L11,-3.5 L4.6,1.6 L7,9.5 L0,4.8 L-7,9.5 L-4.6,1.6 L-11,-3.5 L-3,-3.5Z',
  hatTop: 'M12,46 C16,24 32,8 54,10 C66,11 72,20 72,30',
  plane: 'M-11,-1.5 L-3,-1.5 L-8,-10 L-4.5,-10 L4,-1.5 L10,-1.5 C13,-1.5 13,1.5 10,1.5 L4,1.5 L-4.5,10 L-8,10 L-3,1.5 L-11,1.5 L-13,5 L-15.5,5 L-14,0 L-15.5,-5 L-13,-5Z',
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

  // Foto dengan bingkai; versi printer diolah sesuai pengaturan admin.
  const photoAt = (img, x, top, w, h) => {
    if (print) {
      ctx.drawImage(processPhoto(img, w, h, print), x, top)
    } else {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, x, top, w, h)
    }
    ctx.lineWidth = 2
    ctx.strokeRect(x - 1, top - 1, w + 2, h + 2)
  }

  const barcode = () => {
    const bw = 300
    const scale = bw / 96
    const x0 = (W - bw) / 2
    for (const { x, w } of barcodeBars(t.id)) ctx.fillRect(Math.round(x0 + x * scale), y, Math.max(2, Math.round(w * scale)), 64)
    y += 64
    center(`${meta.no.replace('-', '')}${meta.date.replaceAll('/', '').slice(0, 4)}`, { size: 15, spacing: 4, gap: 0.2 })
  }

  // Teks di tengah; ukuran huruf dikecilkan sampai muat selebar kertas.
  const fitCenter = (text, { size, weight = 700, family = MONO, gap = 0.15, maxW = W - PAD * 2 }) => {
    let s = size
    setFont(s, weight, family)
    while (s > 10 && ctx.measureText(text).width > maxW) setFont(--s, weight, family)
    ctx.textAlign = 'center'
    y += s
    ctx.fillText(text, W / 2, y)
    y += s * gap
  }

  // Baris kecil kiri–kanan.
  const small = (left, right, size = 13, weight = 400) => {
    setFont(size, weight)
    y += size
    ctx.textAlign = 'left'
    ctx.fillText(left, PAD, y)
    ctx.textAlign = 'right'
    ctx.fillText(right, W - PAD, y)
    y += size * 0.35
  }

  const bar = (h = 1.5, gap = 8) => {
    y += gap
    ctx.fillRect(PAD, y, W - PAD * 2, h)
    y += h + gap
  }

  const wrapLines = (text, maxW) => {
    const lines = []
    let cur = ''
    for (const word of text.split(' ')) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && ctx.measureText(next).width > maxW) {
        lines.push(cur)
        cur = word
      } else cur = next
    }
    if (cur) lines.push(cur)
    return lines
  }

  const photoW = W - PAD * 2 - 4
  const photoH = Math.round(photoW / PRINT.photoAspect)

  if (t.layout === 'ticket') {
    /* ---------- Boarding pass ---------- */
    rule(true)
    fitCenter(t.airline, { size: 34, gap: 0.2 })
    center('BOARDING PASS', { size: 15, weight: 700, spacing: 7, gap: 0.3 })
    center(EVENT.subtitle.toUpperCase(), { size: 14, gap: 0.1 })
    rule()

    const [[fromCode, fromCity], [toCode, toCity]] = t.route
    setFont(50, 700)
    y += 46
    ctx.textAlign = 'left'
    ctx.fillText(fromCode, PAD + 2, y)
    ctx.textAlign = 'right'
    ctx.fillText(toCode, W - PAD - 2, y)
    const x1 = PAD + 2 + ctx.measureText(fromCode).width + 12
    const x2 = W - PAD - 2 - ctx.measureText(toCode).width - 12
    const cy = y - 18
    ctx.save()
    ctx.lineWidth = 2
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(x1, cy)
    ctx.lineTo(x2, cy)
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = '#fff'
    ctx.fillRect((x1 + x2) / 2 - 24, cy - 16, 48, 32)
    ctx.fillStyle = '#000'
    icon(PATH.plane, (x1 + x2) / 2, cy, 1.4, { fill: true, width: 1 })
    y += 4
    small(fromCity, toCity, 14)
    rule()

    const cols = (pairs, valueSize) => {
      const cw = (W - PAD * 2) / pairs.length
      ctx.textAlign = 'left'
      setFont(12)
      y += 12
      pairs.forEach(([label], i) => ctx.fillText(label, PAD + 2 + i * cw, y))
      setFont(valueSize, 700)
      y += valueSize + 2
      pairs.forEach(([, value], i) => ctx.fillText(value, PAD + 2 + i * cw, y))
      y += 10
    }
    cols(t.fields, 24)
    cols([['PASSENGER', t.passenger]], 18)
    cols(
      [
        ['DATE', meta.date],
        ['BOARDING', meta.time],
        ['NO.', meta.no],
      ],
      17,
    )
    rule()

    images.forEach((img, i) => {
      y += 4
      photoAt(img, PAD + 2, y, photoW, photoH)
      y += photoH + 2
      leader(`${t.item} ${i + 1}/${images.length}`, 'OK')
      y += 6
    })

    // Garis sobek tiket
    y += 16
    ctx.save()
    ctx.lineWidth = 2
    ctx.setLineDash([4, 5])
    ctx.beginPath()
    ctx.moveTo(PAD + 14, y)
    ctx.lineTo(W - PAD - 14, y)
    ctx.stroke()
    ctx.restore()
    // lekukan setengah lingkaran di kedua pinggir
    for (const [cx, a0, a1] of [
      [0, -Math.PI / 2, Math.PI / 2],
      [W, Math.PI / 2, Math.PI * 1.5],
    ]) {
      ctx.beginPath()
      ctx.arc(cx, y, 11, a0, a1)
      ctx.fill()
    }
    setFont(12, 700)
    const tear = ' TEAR HERE '
    const tw = ctx.measureText(tear).width
    ctx.fillStyle = '#fff'
    ctx.fillRect(W / 2 - tw / 2, y - 9, tw, 18)
    ctx.fillStyle = '#000'
    ctx.textAlign = 'center'
    ctx.fillText(tear, W / 2, y + 4)
    y += 14

    center(`${t.airline}  ${fromCode} > ${toCode}`, { size: 14, weight: 700, gap: 0.5 })
    y += 4
    barcode()
    y += 4
    t.footer.forEach((f) => center(f, { size: FS, weight: 700, gap: 0.2 }))
  } else if (t.layout === 'news') {
    /* ---------- Halaman depan koran ---------- */
    fitCenter(t.masthead, { size: 44, family: SERIF, gap: 0.1 })
    bar(4, 4)
    ctx.fillRect(PAD, y - 1, W - PAD * 2, 1.5)
    y += 2
    small(`VOL. 26  No. ${meta.no}`, meta.date, 13)
    bar(1.5, 4)
    t.headline.forEach((h) => fitCenter(h, { size: 60, family: SERIF, gap: 0.06 }))

    y += 4
    ctx.font = `italic 400 17px ${SERIF}`
    ctx.textAlign = 'center'
    for (const l of wrapLines(t.deck, W - PAD * 2 - 16)) {
      y += 20
      ctx.fillText(l, W / 2, y)
    }
    bar(1.5, 10)

    // Tiga foto bertumpuk, masing-masing dengan keterangan
    images.forEach((img, i) => {
      if (i) y += 12
      photoAt(img, PAD + 2, y, photoW, photoH)
      y += photoH + 2
      let size = 14
      const text = `Fig. ${i + 1} — ${t.captions[i]}`
      ctx.font = `italic 400 ${size}px ${SERIF}`
      while (size > 10 && ctx.measureText(text).width > photoW) ctx.font = `italic 400 ${--size}px ${SERIF}`
      ctx.textAlign = 'center'
      y += 17
      ctx.fillText(text, W / 2, y)
    })
    bar(1.5, 10)

    // Kotak kecil di pinggir (seperti "telinga" koran)
    const boxW = Math.floor((W - PAD * 2 - 10) / 2)
    const boxH = 54
    t.ears.forEach(([label, value], k) => {
      const x = PAD + k * (boxW + 10)
      ctx.lineWidth = 2
      ctx.strokeRect(x + 1, y + 1, boxW - 2, boxH)
      setFont(12, 700)
      ctx.textAlign = 'center'
      ctx.fillText(label, x + boxW / 2, y + 20)
      ctx.font = `700 21px ${SERIF}`
      ctx.fillText(value, x + boxW / 2, y + 45)
    })
    y += boxH + 12

    ctx.font = `italic 400 18px ${SERIF}`
    ctx.textAlign = 'center'
    y += 20
    ctx.fillText(t.footer[0], W / 2, y)
    y += 6
    center(t.footer[1], { size: 14, weight: 700, spacing: 4 })
  } else if (t.layout === 'polaroid') {
    /* ---------- Kartu Natal polaroid ---------- */
    y += 4
    fitCenter(t.title, { size: 66, weight: 400, family: HAND, gap: 0.38 })
    center('COME ALIVE PHOTOBOOTH', { size: 14, weight: 700, spacing: 4, gap: 0.2 })
    center(EVENT.subtitle, { size: 14, gap: 0.2 })
    y += 6

    const fx = PAD + 8
    const fw = W - fx * 2
    const pw = fw - 24
    const ph = Math.round(pw / PRINT.photoAspect)
    images.forEach((img, i) => {
      y += 18
      const top = y
      const fh = 12 + ph + 48
      ctx.lineWidth = 2
      ctx.strokeRect(fx, top, fw, fh)
      photoAt(img, fx + 12, top + 12, pw, ph)
      // selotip di atas bingkai
      ctx.save()
      ctx.translate(W / 2 + (i - 1) * 40, top)
      ctx.rotate(((i % 2 ? 5 : -5) * Math.PI) / 180)
      ctx.fillStyle = '#fff'
      ctx.fillRect(-36, -10, 72, 20)
      ctx.lineWidth = 2
      ctx.strokeRect(-36, -10, 72, 20)
      ctx.beginPath()
      for (let k = -28; k < 40; k += 9) {
        ctx.moveTo(k, -10)
        ctx.lineTo(k - 7, 10)
      }
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
      ctx.fillStyle = '#000'
      // tulisan tangan di bawah foto
      setFont(32, 400, HAND)
      ctx.textAlign = 'center'
      ctx.fillText(t.captions[i] || '', W / 2, top + 12 + ph + 36)
      y = top + fh
    })

    y += 18
    for (const label of ['To:', 'From:']) {
      setFont(28, 400, HAND)
      ctx.textAlign = 'left'
      y += 28
      ctx.fillText(label, PAD + 10, y)
      const lx = PAD + 10 + ctx.measureText(label).width + 10
      ctx.save()
      ctx.lineWidth = 2
      ctx.setLineDash([2, 5])
      ctx.beginPath()
      ctx.moveTo(lx, y + 3)
      ctx.lineTo(W - PAD - 10, y + 3)
      ctx.stroke()
      ctx.restore()
      y += 10
    }
    y += 12
    t.footer.forEach((f, i) => center(f, { size: i ? 14 : 16, weight: 700, spacing: i ? 0 : 3, gap: 0.3 }))
    y += 4
    small(meta.no, `${meta.date} ${meta.time}`, 12)
  } else if (t.layout === 'calendar') {
    /* ---------- Halaman kalender ---------- */
    const [dd, mm, yyyy] = meta.date.split('/').map(Number)
    const day = new Date(yyyy, mm - 1, dd)
    const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

    // cincin spiral
    y += 6
    const rings = 9
    const rs = (W - PAD * 2) / rings
    ctx.lineWidth = 2
    for (let k = 0; k < rings; k++) {
      const cx = PAD + rs * (k + 0.5)
      ctx.beginPath()
      ctx.ellipse(cx, y + 8, 5, 9, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    y += 22
    ctx.fillRect(PAD, y, W - PAD * 2, 2)
    y += 4

    center(`${MONTHS[mm - 1]} ${yyyy}`, { size: 24, weight: 700, spacing: 5, gap: 0 })
    y -= 28 // angka tidak punya bagian atas/bawah setinggi ukuran hurufnya
    fitCenter(String(dd), { size: 170, gap: 0 })
    y += 16
    center(DAYS[day.getDay()], { size: 18, weight: 700, spacing: 6, gap: 0.3 })
    center(t.tagline, { size: 12, gap: 0.4 })

    // kalender mini
    bar(1.5, 6)
    const cw = (W - PAD * 2) / 7
    setFont(12, 700)
    ctx.textAlign = 'center'
    y += 14
    'SMTWTFS'.split('').forEach((d, k) => ctx.fillText(d, PAD + cw * (k + 0.5), y))
    y += 8
    const first = new Date(yyyy, mm - 1, 1).getDay()
    const count = new Date(yyyy, mm, 0).getDate()
    const rowH = 21
    setFont(13)
    for (let n = 1; n <= count; n++) {
      const cell = first + n - 1
      const cx = PAD + cw * ((cell % 7) + 0.5)
      const cy = y + Math.floor(cell / 7) * rowH + 15
      if (n === dd) {
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy - 5, 11, 0, Math.PI * 2)
        ctx.stroke()
        setFont(13, 700)
        ctx.fillText(String(n), cx, cy)
        setFont(13)
      } else ctx.fillText(String(n), cx, cy)
    }
    y += Math.ceil((first + count) / 7) * rowH + 6
    bar(1.5, 6)

    // to-do: kotak centang + foto
    images.forEach((img, i) => {
      y += 8
      const by = y
      ctx.lineWidth = 2
      ctx.strokeRect(PAD + 2, by, 20, 20)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(PAD + 6, by + 10)
      ctx.lineTo(PAD + 11, by + 16)
      ctx.lineTo(PAD + 22, by - 2)
      ctx.stroke()
      setFont(28, 400, HAND)
      ctx.textAlign = 'left'
      ctx.fillText(t.todos[i] || '', PAD + 32, by + 20)
      y = by + 28
      photoAt(img, PAD + 2, y, photoW, photoH)
      y += photoH + 2
    })

    y += 10
    ctx.font = `italic 400 17px ${SERIF}`
    ctx.textAlign = 'center'
    for (const l of wrapLines(t.footer[0], W - PAD * 2 - 10)) {
      y += 20
      ctx.fillText(l, W / 2, y)
    }
    y += 6
    center(t.footer[1], { size: 13, weight: 700, spacing: 4, gap: 0.3 })
    small(meta.no, meta.time, 12)
  } else if (t.layout === 'postcard') {
    /* ---------- Kartu pos ---------- */
    const stampW = 78
    const stampH = 92
    const sx = W - PAD - stampW - 2
    const sy = y + 6
    // perangko
    ctx.save()
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.strokeRect(sx, sy, stampW, stampH)
    ctx.restore()
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 6, sy + 6, stampW - 12, stampH - 12)
    icon(PATH.star, sx + stampW / 2, sy + 38, 1.9)
    setFont(13, 700)
    ctx.textAlign = 'center'
    ctx.fillText('2026', sx + stampW / 2, sy + 74)
    // gelombang + cap pos
    const pcx = sx - 14
    const pcy = sy + 62
    ctx.lineWidth = 2
    for (let k = 0; k < 3; k++) {
      const wy = pcy - 12 + k * 12
      ctx.beginPath()
      for (let x = PAD + 138; x <= pcx - 30; x += 2) {
        const yy = wy + Math.sin((x - PAD) / 7) * 3
        if (x === PAD + 138) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(pcx, pcy, 33, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#000'
    for (const r of [33, 26]) {
      ctx.beginPath()
      ctx.arc(pcx, pcy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    setFont(9, 700)
    ctx.fillText('BANDUNG', pcx, pcy - 5)
    ctx.fillText(meta.date.slice(0, 5), pcx, pcy + 7)
    ctx.fillText('2026', pcx, pcy + 17)
    // tulisan POST CARD
    ctx.textAlign = 'left'
    ctx.font = `700 38px ${SERIF}`
    ctx.fillText('POST', PAD + 2, sy + 34)
    ctx.fillText('CARD', PAD + 2, sy + 72)
    y = sy + stampH + 12

    center('Greetings from', { size: 34, family: HAND, gap: 0.1 })
    fitCenter(t.place, { size: 58, gap: 0.15 })
    center(EVENT.subtitle, { size: 14, gap: 0.2 })
    rule()
    images.forEach((img, i) => {
      if (i) y += 12
      y += 2
      photoAt(img, PAD + 2, y, photoW, photoH)
      y += photoH + 2
    })
    rule()

    // pesan (kiri) dan alamat (kanan)
    const top = y + 4
    const mid = Math.round(W * 0.56)
    ctx.fillRect(mid, top, 2, 112)
    setFont(26, 400, HAND)
    ctx.textAlign = 'left'
    ctx.fillText('Dear friend,', PAD + 4, top + 24)
    ctx.save()
    ctx.lineWidth = 1.5
    ctx.setLineDash([2, 4])
    for (const ly of [52, 80, 108]) {
      ctx.beginPath()
      ctx.moveTo(PAD + 4, top + ly)
      ctx.lineTo(mid - 10, top + ly)
      ctx.stroke()
    }
    ctx.restore()
    setFont(12, 700)
    ctx.fillText('TO:', mid + 12, top + 20)
    t.address.forEach((line, k) => {
      const ly = top + 48 + k * 28
      setFont(13, 700)
      ctx.fillText(line, mid + 12, ly)
      ctx.fillRect(mid + 12, ly + 6, W - PAD - mid - 16, 1.5)
    })
    y = top + 124
    t.footer.forEach((f) => center(f, { size: 15, weight: 700, gap: 0.2 }))
    y += 2
    small(meta.no, `${meta.date} ${meta.time}`, 12)
  } else if (t.layout === 'carol') {
    /* ---------- Lembar lagu ---------- */
    y += 4
    fitCenter(t.title, { size: 42, weight: 'italic 700', family: SERIF, gap: 0.25 })
    center(t.subtitle, { size: 13, weight: 700, spacing: 2, gap: 0.3 })
    small(meta.no, `${meta.date} ${meta.time}`, 12)

    const LINE = 7 // jarak antar garis paranada
    const staff = (notes, lyric, first) => {
      y += 18
      const top = y
      for (let k = 0; k < 5; k++) ctx.fillRect(PAD, top + k * LINE, W - PAD * 2, 1.4)
      ctx.fillRect(PAD, top, 2, LINE * 4 + 1.4)
      ctx.fillRect(W - PAD - 2, top, 2, LINE * 4 + 1.4)
      let x0 = PAD + 18
      if (first) {
        setFont(16, 700)
        ctx.textAlign = 'center'
        ctx.fillText('4', PAD + 14, top + 13)
        ctx.fillText('4', PAD + 14, top + 27)
        x0 = PAD + 34
      }
      const step = (W - PAD - 16 - x0) / notes.length
      notes.forEach((n, k) => {
        const nx = x0 + step * (k + 0.5)
        const ny = top + (n * LINE) / 2
        if (n >= 10) ctx.fillRect(nx - 9, top + 5 * LINE, 18, 1.4) // garis bantu C4
        ctx.save()
        ctx.translate(nx, ny)
        ctx.rotate((-20 * Math.PI) / 180)
        ctx.beginPath()
        ctx.ellipse(0, 0, 5.2, 3.8, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        ctx.lineWidth = 1.6
        ctx.beginPath()
        if (n >= 4) {
          ctx.moveTo(nx + 4.6, ny - 1)
          ctx.lineTo(nx + 4.6, ny - 24)
        } else {
          ctx.moveTo(nx - 4.6, ny + 1)
          ctx.lineTo(nx - 4.6, ny + 24)
        }
        ctx.stroke()
      })
      y = top + LINE * 4 + 12
      ctx.font = `italic 400 15px ${SERIF}`
      ctx.textAlign = 'center'
      y += 16
      ctx.fillText(lyric, W / 2, y)
      y += 8
    }
    images.forEach((img, i) => {
      staff(t.notes[i], t.lyrics[i], i === 0)
      y += 4
      photoAt(img, PAD + 2, y, photoW, photoH)
      y += photoH + 2
    })
    rule()
    ctx.font = `italic 400 15px ${SERIF}`
    ctx.textAlign = 'center'
    y += 15
    ctx.fillText(t.footer[0], W / 2, y)
    y += 6
    center(t.footer[1], { size: 13, weight: 700, spacing: 4, gap: 0.3 })
    fitCenter('Sing along!', { size: 40, weight: 400, family: HAND, gap: 0.1 })
  } else if (t.layout === 'arcade') {
    /* ---------- Game arcade ---------- */
    small('1UP 2412', 'HI-SCORE 999999', 13, 700)
    y += 8
    // judul dengan bayangan
    let ts = 56
    setFont(ts, 700)
    while (ctx.measureText(t.title).width > W - PAD * 2 - 6) setFont(--ts, 700)
    y += ts
    ctx.textAlign = 'center'
    ctx.fillText(t.title, W / 2 + 4, y + 4)
    ctx.fillStyle = '#fff'
    ctx.fillText(t.title, W / 2, y)
    ctx.fillStyle = '#000'
    ctx.lineWidth = 2
    ctx.strokeText(t.title, W / 2, y)
    y += 12
    center(`- ${t.edition} -`, { size: 14, weight: 700, spacing: 2, gap: 0.4 })

    // nyawa: hati piksel
    const HEART = [' XX XX ', 'XXXXXXX', 'XXXXXXX', ' XXXXX ', '  XXX  ', '   X   ']
    const PX = 3
    const hw = 7 * PX
    const totalW = hw * 3 + 14 * 2
    let hx = (W - totalW) / 2
    y += 4
    for (let k = 0; k < 3; k++) {
      HEART.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'X') ctx.fillRect(hx + rx * PX, y + ry * PX, PX, PX)
      })
      hx += hw + 14
    }
    y += 6 * PX + 4
    center('PLAYER 1 READY', { size: 13, weight: 700, spacing: 2, gap: 0.2 })

    images.forEach((img, i) => {
      y += 14
      setFont(15, 700)
      ctx.textAlign = 'left'
      y += 14
      ctx.fillText(`LEVEL ${i + 1}: ${t.levels[i]}`, PAD + 2, y)
      const bw = 96
      const bx = W - PAD - bw - 2
      ctx.lineWidth = 2
      ctx.strokeRect(bx, y - 12, bw, 13)
      ctx.fillRect(bx + 3, y - 9, ((bw - 6) * (i + 1)) / images.length, 7)
      y += 14
      photoAt(img, PAD + 2, y, photoW, photoH)
      ctx.save()
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.strokeRect(PAD - 2, y - 5, photoW + 8, photoH + 10)
      ctx.restore()
      y += photoH + 6
      setFont(12, 700)
      ctx.textAlign = 'right'
      y += 13
      ctx.fillText(`+${(i + 1) * 1000} PTS`, W - PAD - 2, y)
    })
    y += 10
    fitCenter('STAGE CLEAR!', { size: 40, gap: 0.3 })
    center('CONTINUE?  > YES   NO', { size: 15, weight: 700, gap: 0.3 })
    t.footer.forEach((f) => center(f, { size: 12, weight: 700, spacing: 1, gap: 0.3 }))
    small(meta.no, `${meta.date} ${meta.time}`, 12)
  } else if (t.layout === 'certificate') {
    /* ---------- Sertifikat ---------- */
    const top0 = y
    const M = 16
    y += 22
    fitCenter(t.title[0], { size: 34, family: SERIF, gap: 0.05 })
    center(t.title[1], { size: 30, family: HAND, gap: 0 })
    fitCenter(t.title[2], { size: 66, family: SERIF, gap: 0.2 })
    // hiasan garis-bintang-garis
    ctx.fillRect(PAD + 60, y + 4, W / 2 - PAD - 80, 1.5)
    ctx.fillRect(W / 2 + 20, y + 4, W / 2 - PAD - 80, 1.5)
    icon(PATH.star, W / 2, y + 4, 0.9, { fill: true, width: 1 })
    y += 18

    ctx.font = `italic 400 16px ${SERIF}`
    ctx.textAlign = 'center'
    y += 16
    ctx.fillText(t.lines[0], W / 2, y)
    y += 34
    ctx.save()
    ctx.lineWidth = 1.5
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.moveTo(PAD + 40, y)
    ctx.lineTo(W - PAD - 40, y)
    ctx.stroke()
    ctx.restore()
    y += 6
    ctx.font = `italic 400 15px ${SERIF}`
    for (const l of wrapLines(t.lines[1], W - PAD * 2 - M * 2 - 10)) {
      y += 18
      ctx.fillText(l, W / 2, y)
    }
    y += 10

    const pw = W - (PAD + M) * 2 - 4
    const ph = Math.round(pw / PRINT.photoAspect)
    images.forEach((img) => {
      y += 10
      photoAt(img, PAD + M + 2, y, pw, ph)
      y += ph + 2
    })

    // segel + tanda tangan
    y += 14
    const scx = PAD + M + 44
    const scy = y + 46
    ctx.beginPath()
    for (let k = 0; k < 48; k++) {
      const r = k % 2 ? 34 : 40
      const a = (k / 48) * Math.PI * 2
      const px = scx + Math.cos(a) * r
      const py = scy + Math.sin(a) * r
      if (k) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
    ctx.closePath()
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(scx, scy, 27, 0, Math.PI * 2)
    ctx.stroke()
    icon(PATH.star, scx, scy - 6, 1, { fill: true, width: 1 })
    setFont(7, 700)
    ctx.textAlign = 'center'
    ctx.fillText('OFFICIAL', scx, scy + 15)

    const lx0 = PAD + M + 104
    const lx1 = W - PAD - M - 6
    ;[
      [t.signers[0], '', 36],
      [t.signers[1], meta.date, 82],
    ].forEach(([label, value, dy]) => {
      if (value) {
        setFont(22, 400, HAND)
        ctx.textAlign = 'center'
        ctx.fillText(value, (lx0 + lx1) / 2, y + dy - 6)
      }
      ctx.fillRect(lx0, y + dy, lx1 - lx0, 1.5)
      setFont(11, 700)
      ctx.textAlign = 'center'
      ctx.fillText(label, (lx0 + lx1) / 2, y + dy + 15)
    })
    y += 100
    center(meta.no, { size: 12, gap: 0.2 })
    y += 12
    // bingkai ganda + hiasan sudut
    ctx.lineWidth = 3
    ctx.strokeRect(PAD + 1, top0 + 2, W - PAD * 2 - 2, y - top0 - 2)
    ctx.lineWidth = 1.5
    ctx.strokeRect(PAD + 8, top0 + 9, W - PAD * 2 - 16, y - top0 - 16)
    for (const [cx, cy] of [
      [PAD + 8, top0 + 9],
      [W - PAD - 8, top0 + 9],
      [PAD + 8, y - 7],
      [W - PAD - 8, y - 7],
    ]) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-5, -5, 10, 10)
      ctx.restore()
    }
    y += 4
  } else if (t.layout === 'wanted') {
    /* ---------- Poster WANTED ---------- */
    const top0 = y
    const M = 12
    y += 14
    fitCenter('WANTED', { size: 96, family: SERIF, gap: 0.08, maxW: W - (PAD + M) * 2 - 8 })
    fitCenter(t.charge, { size: 15, gap: 0.3 })
    bar(2, 6)
    const pw = W - (PAD + M) * 2 - 4
    const ph = Math.round(pw / PRINT.photoAspect)
    images.forEach((img, i) => {
      y += i ? 18 : 10
      photoAt(img, PAD + M + 2, y, pw, ph)
      ctx.lineWidth = 4
      ctx.strokeRect(PAD + M - 3, y - 5, pw + 10, ph + 10)
      y += ph + 10
      ctx.font = `italic 400 15px ${SERIF}`
      ctx.textAlign = 'center'
      y += 18
      ctx.fillText(`Suspect #${i + 1}: ${t.notes[i]}`, W / 2, y)
    })
    bar(2, 10)
    fitCenter('REWARD', { size: 46, family: SERIF, gap: 0.1 })
    fitCenter(t.reward, { size: 30, gap: 0.35 })
    ctx.font = `italic 400 14px ${SERIF}`
    ctx.textAlign = 'center'
    for (const l of wrapLines(t.seen, W - (PAD + M) * 2 - 10)) {
      y += 17
      ctx.fillText(l, W / 2, y)
    }
    y += 8
    center(`CASE No. ${meta.no}`, { size: 13, weight: 700, spacing: 1, gap: 0.2 })
    t.footer.forEach((f) => center(f, { size: 13, weight: 700, spacing: 2, gap: 0.2 }))
    y += 14
    ctx.lineWidth = 3
    ctx.strokeRect(PAD + 1, top0 + 2, W - PAD * 2 - 2, y - top0 - 2)
    for (const [cx, cy] of [
      [PAD + 12, top0 + 12],
      [W - PAD - 12, top0 + 12],
      [PAD + 12, y - 10],
      [W - PAD - 12, y - 10],
    ]) {
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    y += 4
  } else {
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
    line(`No: ${meta.no}`, `${meta.date} ${meta.time}`)
    line(`Cashier: ${CASHIER}`, '')
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
  }

  y += 28

  const out = document.createElement('canvas')
  out.width = W
  out.height = Math.ceil(y)
  out.getContext('2d').drawImage(tall, 0, 0)
  return out
}
