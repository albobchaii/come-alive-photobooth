/*
 * Aplikasi Express: API + website kiosk (hasil build Vite) di satu domain.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { config } from './config.js'
import { getDb } from './db/index.js'
import { requireDevice } from './auth.js'
import { getStorage } from './storage.js'
import { sessionsRouter } from './routes/sessions.js'
import { downloadRouter } from './routes/download.js'
import { cronRouter } from './routes/cron.js'
import { devStorageRouter } from './routes/devStorage.js'
import { adminRouter } from './routes/admin.js'
import { getEffectivePrintSettings } from './settings.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // Vercel / proxy meneruskan IP asli lewat X-Forwarded-For.
  app.set('trust proxy', 1)

  /* ---------- API ---------- */
  const api = express.Router()
  api.use(express.json({ limit: '32kb' }))

  // Batas umum per IP (melindungi dari tebak-tebak token / spam).
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'too_many_requests' },
    }),
  )

  api.get('/health', async (_req, res) => {
    try {
      const db = await getDb()
      await db.query('SELECT 1')
      res.json({ ok: true, db: db.kind, storage: getStorage().kind })
    } catch {
      res.status(503).json({ ok: false })
    }
  })

  // Pasang di route khusus kiosk terdaftar: cek token + batas per perangkat
  // (kiosk normal jauh di bawah angka ini).
  const kiosk = [
    requireDevice,
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      keyGenerator: (req) => `device:${req.device.code}`,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'too_many_requests' },
    }),
  ]

  // Dipakai halaman /setup kiosk: cek token + nomor struk terakhir kiosk ini
  // (supaya hitungan nomor struk bisa dilanjutkan kalau data tablet terhapus).
  api.get('/devices/me', kiosk, async (req, res, next) => {
    try {
      const db = await getDb()
      const { rows } = await db.query(
        'SELECT receipt_no FROM sessions WHERE device_code = $1 ORDER BY created_at DESC LIMIT 1',
        [req.device.code],
      )
      res.json({ code: req.device.code, name: req.device.name, lastReceiptNo: rows[0]?.receipt_no || null })
    } catch (err) {
      next(err)
    }
  })

  // Pengaturan yang dipakai tablet (hasil cetak). Diambil saat sesi dimulai.
  api.get('/kiosk/config', kiosk, async (req, res, next) => {
    try {
      const db = await getDb()
      const { settings, source } = await getEffectivePrintSettings(db, req.device.code)
      res.set('Cache-Control', 'no-store').json({ print: settings, printSource: source })
    } catch (err) {
      next(err)
    }
  })

  api.use(sessionsRouter(kiosk))
  api.use(adminRouter())
  api.use(cronRouter())
  if (getStorage().kind === 'local') api.use(devStorageRouter())

  api.use((_req, res) => res.status(404).json({ error: 'not_found' }))
  app.use('/api', api)

  /* ---------- Halaman unduhan softfile (dibuka dari HP) ---------- */
  app.use(downloadRouter())

  /* ---------- Website kiosk (SPA) ---------- */
  if (existsSync(config.distDir)) {
    // File ber-hash (assets/*) aman di-cache lama; index.html selalu dicek ulang.
    app.use(
      '/assets',
      express.static(join(config.distDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    )
    app.use(express.static(config.distDir, { index: false, maxAge: '1h' }))
    app.get('/{*path}', (_req, res) => {
      res.set('Cache-Control', 'no-cache')
      res.sendFile(join(config.distDir, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => res.type('text').send('Build frontend dulu: npm run build'))
  }

  /* ---------- Error ---------- */
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err.status === 404 || err.statusCode === 404) return res.status(404).end()
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' })
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' })
    console.error('[server]', req.method, req.originalUrl, err)
    res.status(500).json({ error: 'internal_error' })
  })

  return app
}
