/*
 * Web Worker: film grade Come Alive untuk foto softfile.
 * Berjalan di luar thread utama supaya hitung mundur & kamera tidak tersendat.
 *
 * Masuk : { id, blob, preset, outWidth, quality }
 * Keluar: { id, blob } atau { id, error }
 */
import { PRESETS, WORK_WIDTH, grade } from './film-grade.ts'

self.onmessage = async ({ data: { id, blob, preset, outWidth, quality } }) => {
  try {
    const bmp = await createImageBitmap(blob)
    // 1. Paskan ke WORK_WIDTH: semua angka grade disetel dalam piksel di lebar ini.
    const h = Math.round((bmp.height * WORK_WIDTH) / bmp.width)
    const work = new OffscreenCanvas(WORK_WIDTH, h)
    const wctx = work.getContext('2d')
    wctx.imageSmoothingQuality = 'high'
    wctx.drawImage(bmp, 0, 0, WORK_WIDTH, h)
    bmp.close()
    const src = wctx.getImageData(0, 0, WORK_WIDTH, h)
    const out = grade(src.data, WORK_WIDTH, h, (PRESETS[preset] || PRESETS.interior).params)
    wctx.putImageData(new ImageData(out, WORK_WIDTH, h), 0, 0)

    // 2. Perkecil untuk diunduh (hemat kuota & batas 3 MB per file).
    const oh = Math.round((h * outWidth) / WORK_WIDTH)
    const small = new OffscreenCanvas(outWidth, oh)
    const sctx = small.getContext('2d')
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(work, 0, 0, outWidth, oh)
    const result = await small.convertToBlob({ type: 'image/jpeg', quality })
    self.postMessage({ id, blob: result })
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) })
  }
}
