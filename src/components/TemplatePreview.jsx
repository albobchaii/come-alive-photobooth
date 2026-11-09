import { useEffect, useState } from 'react'
import { EVENT } from '../data/packages.js'
import { renderReceipt } from '../lib/renderReceipt.js'
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
 */
function SlotBox({ photo, active }) {
  const className = `rc__slot${photo ? ' has-photo' : ''}${active ? ' is-active' : ''}`
  const content = photo ? <img src={photo} alt="" /> : <Person />
  return (
    <div className={className} style={{ aspectRatio: PRINT.photoAspect }}>
      {content}
    </div>
  )
}

const Plane = () => (
  <svg className="tk__plane" viewBox="-16 -11 30 22" aria-hidden="true">
    <path d="M-11,-1.5 L-3,-1.5 L-8,-10 L-4.5,-10 L4,-1.5 L10,-1.5 C13,-1.5 13,1.5 10,1.5 L4,1.5 L-4.5,10 L-8,10 L-3,1.5 L-11,1.5 L-13,5 L-15.5,5 L-14,0 L-15.5,-5 L-13,-5Z" />
  </svg>
)

// Boarding pass "Flight to Bethlehem"
function TicketPreview({ t, photos, activeIndex, r }) {
  const [[fromCode, fromCity], [toCode, toCity]] = t.route
  return (
    <div className="tpl">
      <div className="tpl__paper rc rc--ticket">
        <Rule double />
        <div className="rc__head">
          <div className="tk__airline">{t.airline}</div>
          <div className="rc__strong tk__spaced">BOARDING PASS</div>
          <div className="tk__small">{EVENT.subtitle.toUpperCase()}</div>
        </div>
        <Rule />
        <div className="tk__route">
          <span className="tk__code">{fromCode}</span>
          <span className="tk__path">
            <Plane />
          </span>
          <span className="tk__code">{toCode}</span>
        </div>
        <div className="rc__line tk__small">
          <span>{fromCity}</span>
          <span>{toCity}</span>
        </div>
        <Rule />
        <div className="tk__cols">
          {t.fields.map(([l, v]) => (
            <div key={l}>
              <div className="tk__label">{l}</div>
              <div className="tk__val">{v}</div>
            </div>
          ))}
        </div>
        <div className="tk__cols tk__cols--one">
          <div>
            <div className="tk__label">PASSENGER</div>
            <div className="tk__val tk__val--sm">{t.passenger}</div>
          </div>
        </div>
        <div className="tk__cols">
          {[
            ['DATE', r.date],
            ['BOARDING', r.time],
            ['NO.', r.no],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="tk__label">{l}</div>
              <div className="tk__val tk__val--xs">{v}</div>
            </div>
          ))}
        </div>
        <Rule />
        {Array.from({ length: PRINT.photosPerStrip }, (_, i) => (
          <div key={i} className="rc__item">
            <SlotBox photo={photos?.[i]} active={i === activeIndex} />
            <div className="rc__line rc__line--leader">
              <span>
                {t.item} {i + 1}/{PRINT.photosPerStrip}
              </span>
              <span className="rc__dots" />
              <span>OK</span>
            </div>
          </div>
        ))}
        <div className="tk__tear">
          <span>TEAR HERE</span>
        </div>
        <div className="rc__center rc__strong tk__small">
          {t.airline} {fromCode} &gt; {toCode}
        </div>
        <div className="rc__code">
          <Barcode seed={t.id} />
          <div className="rc__codetext">{r.no.replace('-', '')}2412</div>
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

// Kartu Natal polaroid
function PolaroidPreview({ t, photos, activeIndex, r }) {
  return (
    <div className="tpl">
      <div className="tpl__paper rc rc--polaroid">
        <div className="pl__title">{t.title}</div>
        <div className="rc__center rc__strong pl__spaced">COME ALIVE PHOTOBOOTH</div>
        <div className="rc__center pl__small">{EVENT.subtitle}</div>
        {Array.from({ length: PRINT.photosPerStrip }, (_, i) => (
          <div key={i} className="pl__frame">
            <span className={`pl__tape pl__tape--${i}`} />
            <SlotBox photo={photos?.[i]} active={i === activeIndex} />
            <div className="pl__cap">{t.captions[i]}</div>
          </div>
        ))}
        {['To:', 'From:'].map((l) => (
          <div key={l} className="pl__line">
            <span>{l}</span>
            <span className="pl__blank" />
          </div>
        ))}
        {t.footer.map((f, i) => (
          <div key={i} className={`rc__center rc__strong${i ? ' pl__small' : ' pl__spaced'}`}>
            {f}
          </div>
        ))}
        <div className="rc__line pl__small">
          <span>{r.no}</span>
          <span>
            {r.date} {r.time}
          </span>
        </div>
      </div>
    </div>
  )
}

/*
 * Pratinjau yang digambar langsung dengan renderer cetak (pasti sama dengan
 * hasil print). Foto diganti siluet abu-abu.
 */
const CANVAS_LAYOUTS = new Set(['postcard', 'calendar', 'news', 'carol', 'arcade', 'certificate', 'wanted'])
const previewCache = new Map()
let placeholder

function placeholderPhoto() {
  if (placeholder) return placeholder
  const c = document.createElement('canvas')
  c.width = 400
  c.height = 300
  const x = c.getContext('2d')
  x.fillStyle = '#e6e6e6'
  x.fillRect(0, 0, 400, 300)
  x.fillStyle = 'rgba(0,0,0,0.13)'
  for (let i = 0; i < 400; i += 12)
    for (let j = 0; j < 300; j += 12) {
      x.beginPath()
      x.arc(i + 6, j + 6, 1.8, 0, Math.PI * 2)
      x.fill()
    }
  x.fillStyle = '#9b9b9b'
  x.beginPath()
  x.arc(200, 150, 42, 0, Math.PI * 2)
  x.fill()
  x.beginPath()
  x.ellipse(200, 300, 88, 92, 0, Math.PI, 0)
  x.fill()
  placeholder = c.toDataURL()
  return placeholder
}

function CanvasPreview({ t }) {
  const [src, setSrc] = useState(() => previewCache.get(t.id) || null)
  useEffect(() => {
    if (src) return
    let alive = true
    const p = placeholderPhoto()
    renderReceipt({ template: t, photos: [p, p, p], meta: SAMPLE_RECEIPT })
      .then((c) => {
        const url = c.toDataURL('image/png')
        previewCache.set(t.id, url)
        if (alive) setSrc(url)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [t, src])
  return (
    <div className="tpl">
      <div className="tpl__paper tpl__paper--img">
        {src ? <img src={src} alt="" /> : <div className="tpl__placeholder" />}
      </div>
    </div>
  )
}

export default function TemplatePreview({ template: t, photos, activeIndex = -1 }) {
  const r = SAMPLE_RECEIPT
  if (t.layout === 'polaroid') return <PolaroidPreview t={t} photos={photos} activeIndex={activeIndex} r={r} />
  if (t.layout === 'ticket') return <TicketPreview t={t} photos={photos} activeIndex={activeIndex} r={r} />
  if (CANVAS_LAYOUTS.has(t.layout)) return <CanvasPreview t={t} />
  return (
    <div className="tpl">
      <div className="tpl__paper rc">
        <Header style={t.header} />
        <div className="rc__center">Bethel Teens &amp; Youth</div>
        <div className="rc__center">{EVENT.subtitle}</div>

        <Rule />
        <Line left={`No: ${r.no}`} right={`${r.date} ${r.time}`} />
        <Line left={`Cashier: ${CASHIER}`} right="" />
        <Rule />

        {Array.from({ length: PRINT.photosPerStrip }, (_, i) => (
          <div key={i} className="rc__item">
            <SlotBox photo={photos?.[i]} active={i === activeIndex} />
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
