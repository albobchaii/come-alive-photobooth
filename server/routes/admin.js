/*
 * API panel admin (/admin). Semua route kecuali login butuh sesi admin.
 *
 *  POST  /api/admin/login                 { password }
 *  POST  /api/admin/logout
 *  GET   /api/admin/me
 *  GET   /api/admin/devices               daftar kiosk + status
 *  POST  /api/admin/devices               { code, name }  → token (sekali tampil)
 *  POST  /api/admin/devices/:code/rotate  → token baru
 *  PATCH /api/admin/devices/:code         { active?, name? }
 *  GET   /api/admin/print-settings        umum + khusus tiap kiosk
 *  PUT   /api/admin/print-settings        { target: 'global' | 'A'…, settings | null }
 *  GET   /api/admin/sample-photos         foto sesi terakhir untuk pratinjau
 */
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { getDb } from '../db/index.js'
import { getStorage, SESSION_FILES } from '../storage.js'
import { adminEnabled, checkPassword, endAdminSession, isAdmin, requireAdmin, startAdminSession } from '../adminAuth.js'
import {
  CODE_RE,
  addDevice,
  listDevices,
  renameDevice,
  rotateDevice,
  setDeviceActive,
} from '../devices.js'
import { getGlobalPrintSettings, saveDevicePrintSettings, saveGlobalPrintSettings } from '../settings.js'
import { normalizePrintSettings } from '../../src/lib/printSettings.js'

const ONLINE_MS = 2 * 60 * 1000

export function adminRouter() {
  const r = express.Router()

  // Maks 10 percobaan login per 15 menit per IP.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'too_many_attempts' },
  })

  r.post('/admin/login', loginLimiter, (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!adminEnabled()) return res.status(503).json({ error: 'admin_disabled' })
    if (!checkPassword(req.body?.password)) return res.status(401).json({ error: 'wrong_password' })
    startAdminSession(res)
    res.json({ ok: true })
  })

  r.post('/admin/logout', (_req, res) => {
    endAdminSession(res)
    res.json({ ok: true })
  })

  r.get('/admin/me', (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ enabled: adminEnabled(), loggedIn: isAdmin(req) })
  })

  r.use('/admin', requireAdmin)

  /* ---------- Kiosk ---------- */
  r.get('/admin/devices', async (_req, res, next) => {
    try {
      const db = await getDb()
      const now = Date.now()
      const rows = await listDevices(db)
      res.json({
        devices: rows.map((d) => ({
          code: d.code,
          name: d.name,
          active: d.active,
          lastSeen: d.last_seen,
          online: Boolean(d.last_seen && now - new Date(d.last_seen) < ONLINE_MS),
          sessions24h: d.sessions_24h,
          lastSessionAt: d.last_session_at,
          hasOwnPrintSettings: Boolean(d.print_settings),
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  r.post('/admin/devices', async (req, res, next) => {
    try {
      const code = String(req.body?.code || '').toUpperCase()
      if (!CODE_RE.test(code)) return res.status(400).json({ error: 'invalid_code' })
      const db = await getDb()
      const token = await addDevice(db, code, req.body?.name)
      if (!token) return res.status(409).json({ error: 'code_taken' })
      res.status(201).json({ code, token })
    } catch (err) {
      next(err)
    }
  })

  r.post('/admin/devices/:code/rotate', async (req, res, next) => {
    try {
      const db = await getDb()
      const token = await rotateDevice(db, req.params.code)
      if (!token) return res.status(404).json({ error: 'not_found' })
      res.json({ code: req.params.code, token })
    } catch (err) {
      next(err)
    }
  })

  r.patch('/admin/devices/:code', async (req, res, next) => {
    try {
      const db = await getDb()
      const { code } = req.params
      const { active, name } = req.body || {}
      let found = true
      if (typeof active === 'boolean') found = await setDeviceActive(db, code, active)
      if (found && typeof name === 'string') found = await renameDevice(db, code, name)
      if (!found) return res.status(404).json({ error: 'not_found' })
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  /* ---------- Hasil cetak ---------- */
  r.get('/admin/print-settings', async (_req, res, next) => {
    try {
      const db = await getDb()
      const { rows } = await db.query('SELECT code, print_settings FROM devices ORDER BY code')
      const devices = {}
      for (const d of rows) devices[d.code] = d.print_settings ? normalizePrintSettings(d.print_settings) : null
      res.json({ global: await getGlobalPrintSettings(db), devices })
    } catch (err) {
      next(err)
    }
  })

  r.put('/admin/print-settings', async (req, res, next) => {
    try {
      const db = await getDb()
      const { target, settings } = req.body || {}
      if (target === 'global') {
        if (!settings) return res.status(400).json({ error: 'settings_required' })
        return res.json({ target, settings: await saveGlobalPrintSettings(db, settings) })
      }
      if (!CODE_RE.test(target || '')) return res.status(400).json({ error: 'invalid_target' })
      const saved = await saveDevicePrintSettings(db, target, settings)
      if (saved === undefined) return res.status(404).json({ error: 'not_found' })
      res.json({ target, settings: saved })
    } catch (err) {
      next(err)
    }
  })

  // 3 foto dari sesi terakhir yang selesai, untuk pratinjau dengan foto asli.
  r.get('/admin/sample-photos', async (_req, res, next) => {
    try {
      const db = await getDb()
      const { rows } = await db.query(
        `SELECT id, receipt_no FROM sessions WHERE status = 'ready' AND expires_at > now()
         ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
      )
      if (!rows[0]) return res.json({ photos: [] })
      const names = SESSION_FILES.filter((n) => n.startsWith('foto-'))
      const urls = await getStorage().downloadUrls(rows[0].id, names)
      res.json({ receiptNo: rows[0].receipt_no, photos: names.map((n) => urls[n]).filter(Boolean) })
    } catch (err) {
      next(err)
    }
  })

  return r
}
