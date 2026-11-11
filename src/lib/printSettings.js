/*
 * Pengaturan hasil cetak thermal. Dipakai bersama oleh:
 *  - frontend (render struk untuk printer, pratinjau di admin)
 *  - server (validasi sebelum disimpan)
 * File ini tidak boleh memakai API browser.
 *
 * Hanya memengaruhi versi struk yang dikirim ke printer. Tampilan di layar
 * dan softfile tetap memakai foto asli.
 */

export const PRINT_MODES = {
  gray: 'Abu-abu (printer yang mengubah ke titik)',
  dither: 'Titik-titik (dithering, disarankan untuk thermal)',
  threshold: 'Hitam-putih tegas (tanpa gradasi)',
}

// Nilai awal = setara cetakan sebelum ada pengaturan (tanpa olahan).
export const DEFAULT_PRINT_SETTINGS = {
  mode: 'gray',
  brightness: 1,
  contrast: 1,
  gamma: 1,
  threshold: 128,
  feedMm: 15,
}

// Batas tiap slider: [min, max, langkah]
export const PRINT_LIMITS = {
  brightness: [0.5, 1.6, 0.01],
  contrast: [0.5, 2, 0.01],
  gamma: [0.5, 1.6, 0.01],
  threshold: [40, 220, 1],
  feedMm: [0, 40, 1],
}

// Preset sesuai cahaya di lokasi foto (semua memakai mode titik-titik).
// Makin gelap ruangan, foto makin gelap → terang dinaikkan & gamma diturunkan
// supaya wajah tetap kelihatan; kontras ikut naik supaya tidak kusam.
export const LIGHT_PRESETS = [
  {
    id: 'terang',
    label: 'Terang',
    hint: 'Ruangan terang / siang / ada ring light',
    values: { mode: 'dither', brightness: 1.03, contrast: 1.15, gamma: 0.92 },
  },
  {
    id: 'redup',
    label: 'Redup',
    hint: 'Lampu ruangan biasa, agak remang',
    values: { mode: 'dither', brightness: 1.12, contrast: 1.2, gamma: 0.8 },
  },
  {
    id: 'gelap',
    label: 'Gelap',
    hint: 'Lampu panggung / malam / cahaya minim',
    values: { mode: 'dither', brightness: 1.25, contrast: 1.3, gamma: 0.68 },
  },
]

export const matchPreset = (s) =>
  LIGHT_PRESETS.find((p) => Object.entries(p.values).every(([k, v]) => s[k] === v))?.id ?? null

const clamp = (v, [min, max, step]) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const stepped = Math.round(n / step) * step
  return Math.min(max, Math.max(min, Number(stepped.toFixed(4))))
}

// Rapikan masukan (dari admin/server/cache) menjadi pengaturan yang valid.
export function normalizePrintSettings(input) {
  const src = input && typeof input === 'object' ? input : {}
  const out = { ...DEFAULT_PRINT_SETTINGS }
  if (src.mode in PRINT_MODES) out.mode = src.mode
  for (const key of Object.keys(PRINT_LIMITS)) {
    const v = clamp(src[key], PRINT_LIMITS[key])
    if (v !== null) out[key] = v
  }
  return out
}
