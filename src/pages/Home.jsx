import { useNavigate } from 'react-router-dom'
import { SantaHat } from '../components/Doodles.jsx'
import Logos from '../components/Logos.jsx'
import SideDoodle from '../components/SideDoodle.jsx'
import { EVENT } from '../data/packages.js'
import { clearSession, peekSessionId } from '../lib/session.js'
import { abandonSoftfile } from '../lib/softfile.js'

// Huruf "PhotoBooth" dibuat sedikit miring/naik-turun seperti tulisan tangan.
const LETTERS = [
  { c: 'P', hat: true }, { c: 'h' }, { c: 'o', r: -4 }, { c: 't', r: 3 }, { c: 'o', small: true, y: -0.35 },
  { c: 'B', r: -3, gap: true }, { c: 'o', small: true, y: -0.45 }, { c: 'o', small: true, y: -0.1 },
  { c: 't', r: 4 }, { c: 'h', r: -2 },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <>
      <main className="poster">
        {/* penyeimbang tinggi footer supaya hero benar-benar di tengah layar */}
        <div className="poster__spacer" aria-hidden="true" />

        <section className="hero">
          <SideDoodle type="twin" side="left" />
          <SideDoodle type="single" side="right" />

          <h1 className="brand" aria-label={`${EVENT.title} PhotoBooth`}>
            <span className="brand__event" aria-hidden="true">
              {EVENT.title.split('').map((c, i) => (
                <span key={i} className="brand__l" style={{ '--d': `${i * 0.05}s`, '--wave': `${i * 0.12}s` }}>
                  {c === ' ' ? '\u00A0' : c}
                </span>
              ))}
            </span>
            <span className="brand__word" aria-hidden="true">
              {LETTERS.map((l, i) => (
                <span
                  key={i}
                  className={`brand__l${l.small ? ' is-small' : ''}${l.gap ? ' has-gap' : ''}`}
                  style={{
                    '--r': `${l.r ?? 0}deg`,
                    '--y': `${l.y ?? 0}em`,
                    '--d': `${0.35 + i * 0.06}s`,
                    '--wave': `${0.6 + i * 0.12}s`,
                  }}
                >
                  {l.c}
                  {l.hat && <SantaHat className="brand__hat" />}
                </span>
              ))}
            </span>
          </h1>

          <p className="event-sub">{EVENT.subtitle}</p>

          <div className="cta-wrap">
            <button type="button" className="cta" onClick={() => {
                // Pengunjung baru: hapus foto & struk sesi sebelumnya
                // (sesi yang ditinggal sebelum selesai ikut dibatalkan di server).
                abandonSoftfile(peekSessionId())
                clearSession()
                navigate('/template')
              }}>
              Mulai Foto
            </button>
          </div>
        </section>

        <footer className="poster__bottom">
          <Logos />
        </footer>
      </main>
    </>
  )
}
