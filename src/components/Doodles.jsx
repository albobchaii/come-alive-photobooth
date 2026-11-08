/*
 * Ilustrasi gaya "digambar tangan" pakai SVG.
 * Filter #rough memberi efek garis goyang seperti spidol.
 */

export function DoodleDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3.5" />
        </filter>
        <symbol id="santa-hat" viewBox="0 0 80 62">
          <path d="M12,46 C16,24 32,8 54,10 C66,11 72,20 72,30" />
          <circle cx="72" cy="37" r="6" />
          <path d="M6,46 C26,40 44,40 64,46 C62,51 62,54 64,58 C44,52 26,52 6,58 C8,54 8,50 6,46Z" />
        </symbol>
      </defs>
    </svg>
  )
}

export function SantaHat({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 62" aria-hidden="true">
      <g className="ink ink--fill" filter="url(#rough)">
        <use href="#santa-hat" />
      </g>
    </svg>
  )
}

export function Snowflake({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="-12 -12 24 24" aria-hidden="true">
      <g className="ink">
        <path d="M0,-10 V10 M-8.7,-5 L8.7,5 M-8.7,5 L8.7,-5" />
      </g>
    </svg>
  )
}
