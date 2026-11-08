import teensLogo from '../assets/logos/bethel-teens.png'
import youthLogo from '../assets/logos/bethel-youth.png'

/*
 * Logo asli berwarna putih (PNG transparan). Dipakai sebagai CSS mask
 * supaya warnanya ikut --ink dan menyatu dengan gaya poster.
 */
const LOGOS = [
  { src: teensLogo, alt: 'Bethel Teens', ratio: 1000 / 322 },
  { src: youthLogo, alt: 'Bethel Youth', ratio: 1000 / 270 },
]

export default function Logos() {
  return (
    <div className="logos">
      {LOGOS.map((l, i) => (
        <span key={l.alt} className="logos__item-wrap">
          {i > 0 && (
            <span className="logos__sep" aria-hidden="true">
              ×
            </span>
          )}
          <span
            role="img"
            aria-label={l.alt}
            className="logos__item"
            style={{ '--logo': `url(${l.src})`, aspectRatio: l.ratio }}
          />
        </span>
      ))}
    </div>
  )
}
