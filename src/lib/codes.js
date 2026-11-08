/*
 * Pola barcode & QR hiasan (bukan kode yang bisa di-scan).
 * Dipakai bersama oleh pratinjau (SVG) dan hasil cetak (canvas) supaya
 * polanya identik.
 */

// Angka acak yang selalu sama untuk seed yang sama.
export function seeded(seed) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 2 ** 32
  }
}

// Daftar batang hitam {x, w} dalam satuan 0..width.
export function barcodeBars(seed, width = 96) {
  const rand = seeded(seed)
  const bars = []
  let x = 0
  let black = true
  while (x < width) {
    const w = 1 + Math.floor(rand() * 3)
    if (black) bars.push({ x, w: Math.min(w, width - x) })
    x += w
    black = !black
  }
  return bars
}

// QR 21x21: sel hitam acak + 3 penanda sudut.
export function qrCells(seed, n = 21) {
  const rand = seeded(seed)
  const isFinder = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)
  const cells = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (!isFinder(x, y) && rand() > 0.55) cells.push([x, y])
  return {
    n,
    cells,
    finders: [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ],
  }
}
