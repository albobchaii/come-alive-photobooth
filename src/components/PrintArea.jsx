import { PRINT } from '../data/templates.js'

/*
 * Bagian yang hanya muncul saat window.print(): gambar struk selebar area
 * cetak 48 mm di kertas 58 mm. Tinggi kertas = tinggi struk + jarak sobek
 * (feedMm, diatur di panel admin) karena printer tidak punya pemotong.
 */
export default function PrintArea({ image, feedMm = 15 }) {
  if (!image) return null
  const heightMm = Math.ceil((image.height / image.width) * PRINT.printableMm) + feedMm
  return (
    <div className="print-area">
      <style>{`@page { size: ${PRINT.paperMm}mm ${heightMm}mm; margin: 0; }`}</style>
      <img src={image.url} alt="" style={{ width: `${PRINT.printableMm}mm` }} />
    </div>
  )
}
