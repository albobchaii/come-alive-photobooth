import { EVENT } from '../data/packages.js'
import { PRINT, SAMPLE_RECEIPT, CASHIER } from '../data/templates.js'
import { barcodeBars, qrCells } from '../lib/codes.js'

/*
 * Pratinjau strip bergaya struk belanja, seperti hasil cetak printer
 * thermal 58 mm: kertas putih, tinta hitam, huruf mesin kasir.
 * Semua ukuran memakai cqw (persen lebar kertas) supaya proporsinya
 * sama dengan hasil cetak berapa pun ukuran pratinjaunya.
 */

const Person = () => (
  <svg className="rc__person" viewBox="0 0 40 30" aria-hidden="true">
    <circle cx="20" cy="11" r="6" />
    <path d="M9,30 C9,22 14,18 20,18 C26,18 31,22 31,30Z" />
  </svg>
)

const Line = ({ left, right }) => (
  <div className="rc__line">
    <span>{left}</span>
    <span>{right}</span>
  </div>
)

const Rule = ({ double }) => <div className={`rc__rule${double ? ' rc__rule--double' : ''}`} />

function Barcode({ seed }) {
  return (
    <svg className="rc__barcode" viewBox="0 0 96 22" preserveAspectRatio="none" aria-hidden="true">
      {barcodeBars(seed).map(({ x, w }) => (
        <rect key={x} x={x} y="0" width={w} height="22" />
      ))}
    </svg>
  )
}

function QrCode({ seed }) {
  const { n, cells, finders } = qrCells(seed)
  return (
    <svg className="rc__qr" viewBox={`0 0 ${n} ${n}`} aria-hidden="true">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
      ))}
      {finders.map(([x, y]) => (
        <g key={`f${x}-${y}`} transform={`translate(${x} ${y})`}>
          <rect x="0.5" y="0.5" width="6" height="6" fill="none" stroke="currentColor" />
          <rect x="2" y="2" width="3" height="3" />
        </g>
      ))}
    </svg>
  )
}

const Hat = () => (
  <svg className="rc__hat" viewBox="0 0 80 62" aria-hidden="true">
    <g>
      <path d="M12,46 C16,24 32,8 54,10 C66,11 72,20 72,30" />
      <circle cx="72" cy="37" r="6" />
      <path d="M6,46 C26,40 44,40 64,46 C62,51 62,54 64,58 C44,52 26,52 6,58 C8,54 8,50 6,46Z" />
    </g>
  </svg>
)

const Tree = () => (
  <svg className="rc__icon" viewBox="-12 -12 24 24" aria-hidden="true">
    <path d="M0,-11 L-6,-2 H-3 L-9,6 H9 L3,-2 H6Z M0,6 V11" />
  </svg>
)

const Star = () => (
  <svg className="rc__icon" viewBox="-12 -12 24 24" aria-hidden="true">
    <path d="M0,-11 L3,-3.5 L11,-3.5 L4.6,1.6 L7,9.5 L0,4.8 L-7,9.5 L-4.6,1.6 L-11,-3.5 L-3,-3.5Z" />
  </svg>
)

function Header({ style }) {
  if (style === 'hand')
    return (
      <div className="rc__head rc__head--hand">
        <Hat />
        <div className="rc__hand">{EVENT.title}</div>
        <div className="rc__strong">PHOTOBOOTH</div>
      </div>
    )
  if (style === 'xmas')
    return (
      <div className="rc__head">
        <div className="rc__icons">
          <Tree />
          <Star />
          <Tree />
        </div>
        <div className="rc__big">{EVENT.title.toUpperCase()}</div>
        <div className="rc__strong">PHOTOBOOTH</div>
      </div>
    )
  if (style === 'stars')
    return (
      <div className="rc__head">
        <div className="rc__muted">********************************</div>
        <div className="rc__big rc__big--wide">{EVENT.title.toUpperCase()}</div>
        <div className="rc__muted">******** PHOTOBOOTH *********</div>
      </div>
    )
  return (
    <div className="rc__head">
      <div className="rc__big">{EVENT.title.toUpperCase()}</div>
      <div className="rc__strong">PHOTOBOOTH</div>
    </div>
  )
}

/*
 * photos      : (opsional) array data URL foto untuk mengisi slot
 * activeIndex : (opsional) slot yang sedang difoto, diberi sorotan
 * onSlotClick : (opsional) klik slot, mis. untuk mengulang satu foto
 */
function SlotBox({ photo, active, onClick, label }) {
  const className = `rc__slot${photo ? ' has-photo' : ''}${active ? ' is-active' : ''}`
  const content = photo ? <img src={photo} alt="" /> : <Person />
  if (onClick && photo)
    return (
      <button
        type="button"
        className={className}
        style={{ aspectRatio: PRINT.photoAspect }}
        onClick={onClick}
        aria-label={`Ulangi ${label}`}
      >
        {content}
      </button>
    )
  return (
    <div className={className} style={{ aspectRatio: PRINT.photoAspect }}>
      {content}
    </div>
  )
}

export default function TemplatePreview({ template: t, photos, activeIndex = -1, onSlotClick }) {
  const r = SAMPLE_RECEIPT
  return (
    <div className="tpl">
      <div className="tpl__paper rc">
        <Header style={t.header} />
        <div className="rc__center">Bethel Teens &amp; Youth</div>
        <div className="rc__center">{EVENT.subtitle}</div>

        <Rule />
        <Line left={`No: ${r.no}`} right={r.date} />
        <Line left={`Kasir: ${CASHIER}`} right={r.time} />
        <Rule />

        {Array.from({ length: PRINT.photosPerStrip }, (_, i) => (
          <div key={i} className="rc__item">
            <SlotBox
              photo={photos?.[i]}
              active={i === activeIndex}
              onClick={onSlotClick ? () => onSlotClick(i) : undefined}
              label={`${t.item} #${i + 1}`}
            />
            <div className="rc__line rc__line--leader">
              <span>
                {t.item} #{i + 1}
              </span>
              <span className="rc__dots" />
              <span>1x</span>
            </div>
          </div>
        ))}

        <Rule />
        {t.totals.map(([l, rt], i) => (
          <Line key={i} left={l} right={rt} />
        ))}
        <Rule double />

        <div className="rc__code">
          {t.code === 'qr' ? <QrCode seed={t.id} /> : <Barcode seed={t.id} />}
          {t.code === 'barcode' && <div className="rc__codetext">{r.no.replace('-', '')}122026</div>}
        </div>

        {t.footer.map((f, i) => (
          <div key={i} className="rc__center rc__strong">
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}
