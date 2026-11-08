/*
 * Foto uji buatan (tanpa foto orang sungguhan) untuk pratinjau di admin dan
 * "Cetak uji" di tablet. Berisi gradasi gelap→terang, lingkaran "wajah",
 * dan detail halus, supaya efek terang/kontras/titik mudah dinilai.
 */
export function makeTestPhoto(variant = 0, w = 960, h = 720) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')

  // latar gradasi
  const bg = x.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, ['#f4d9c6', '#c9dff2', '#e8e0c8'][variant % 3])
  bg.addColorStop(1, ['#6b3b2a', '#2a4a6b', '#4b5a2a'][variant % 3])
  x.fillStyle = bg
  x.fillRect(0, 0, w, h)

  // "orang": kepala + badan
  const people = variant === 1 ? [0.35, 0.65] : variant === 2 ? [0.25, 0.5, 0.75] : [0.5]
  people.forEach((px, i) => {
    const cx = px * w
    const skin = ['#f1c7a5', '#d9a07a', '#a8714f'][(i + variant) % 3]
    x.fillStyle = ['#c8102e', '#1f3a5f', '#2f5d3a'][(i + variant) % 3]
    x.beginPath()
    x.ellipse(cx, h * 0.98, w * 0.13, h * 0.32, 0, 0, Math.PI * 2)
    x.fill()
    const face = x.createRadialGradient(cx - 30, h * 0.4 - 40, 10, cx, h * 0.42, w * 0.11)
    face.addColorStop(0, '#fff3e6')
    face.addColorStop(0.35, skin)
    face.addColorStop(1, '#5a3422')
    x.fillStyle = face
    x.beginPath()
    x.arc(cx, h * 0.42, w * 0.095, 0, Math.PI * 2)
    x.fill()
    // mata & senyum
    x.fillStyle = '#1a1a1a'
    x.beginPath()
    x.arc(cx - 28, h * 0.4, 8, 0, Math.PI * 2)
    x.arc(cx + 28, h * 0.4, 8, 0, Math.PI * 2)
    x.fill()
    x.strokeStyle = '#1a1a1a'
    x.lineWidth = 6
    x.beginPath()
    x.arc(cx, h * 0.44, 34, 0.15 * Math.PI, 0.85 * Math.PI)
    x.stroke()
  })

  // skala abu-abu 0–100% di bawah, untuk menilai gradasi
  const steps = 11
  const bw = w / steps
  for (let i = 0; i < steps; i++) {
    const v = Math.round((i / (steps - 1)) * 255)
    x.fillStyle = `rgb(${v},${v},${v})`
    x.fillRect(i * bw, h - 46, bw + 1, 46)
  }

  // garis halus untuk menilai ketajaman
  x.strokeStyle = '#000'
  x.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    x.beginPath()
    x.moveTo(24 + i * 10, 24)
    x.lineTo(24 + i * 10, 110)
    x.stroke()
  }
  return c.toDataURL('image/jpeg', 0.92)
}

export const testPhotos = () => [0, 1, 2].map((v) => makeTestPhoto(v))
