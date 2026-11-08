import twinPack from '../assets/doodles/twin-pack.png'
import singleStrip from '../assets/doodles/single-strip.png'

/*
 * Gambar tangan strip foto (PNG transparan) dipakai sebagai CSS mask
 * supaya warnanya mengikuti --ink.
 */
const DOODLES = {
  twin: { src: twinPack, ratio: 496 / 405 },
  single: { src: singleStrip, ratio: 351 / 396 },
}

export default function SideDoodle({ type, side }) {
  const d = DOODLES[type]
  return (
    <span
      aria-hidden="true"
      className={`side-doodle side-doodle--${side}`}
      style={{ '--img': `url(${d.src})`, aspectRatio: d.ratio }}
    />
  )
}
