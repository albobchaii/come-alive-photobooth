/*
 * API sesi softfile.
 *
 *  Kiosk (wajib X-Device-Token):
 *   POST   /api/sessions               daftar sesi + minta URL upload (aman diulang)
 *   POST   /api/sessions/:id/complete  tandai siap (cek semua file sudah ada)
 *   DELETE /api/sessions/:id           Batal: hapus file & tandai cancelled
 *
 *  Publik:
 *   GET    /api/sessions/:id/status    dipakai halaman unduhan saat menunggu
 */
import express from 'express'
import { TEMPLATES } from '../../src/data/templates.js'
import { getDb } from '../db/index.js'
import { config } from '../config.js'
import { SESSION_FILES, getStorage } from '../storage.js'

export const ID_RE = /^[A-Za-z0-9]{8,16}$/
const RECEIPT_RE = /^CA-[A-Z]\d{4,6}$/
const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id))

const bad = (res, error, status = 400) => res.status(status).json({ error })

async function findSession(id) {
  const db = await getDb()
  const { rows } = await db.query(
    'SELECT id, device_code, receipt_no, template_id, status, expires_at FROM sessions WHERE id = $1',
    [id],
  )
  return rows[0] || null
}

export function sessionsRouter(kiosk) {
  const r = express.Router()

  r.post('/sessions', kiosk, async (req, res, next) => {
    try {
      const { id, receiptNo, templateId } = req.body || {}
      if (!ID_RE.test(id || '')) return bad(res, 'invalid_id')
      if (!RECEIPT_RE.test(receiptNo || '') || receiptNo[3] !== req.device.code)
        return bad(res, 'invalid_receipt_no')
      if (!TEMPLATE_IDS.has(templateId)) return bad(res, 'invalid_template')

      const db = await getDb()
      await db.query(
        `INSERT INTO sessions (id, device_code, receipt_no, template_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
         ON CONFLICT (id) DO NOTHING`,
        [id, req.device.code, receiptNo, templateId, config.retentionDays],
      )
      const s = await findSession(id)
      // ID sudah dipakai kiosk lain / sudah dibatalkan → jangan beri akses upload.
      if (s.device_code !== req.device.code) return bad(res, 'id_taken', 409)
      if (s.status === 'cancelled') return bad(res, 'session_cancelled', 409)

      const uploads = await getStorage().uploadTargets(id, SESSION_FILES)
      res.status(201).json({ id, status: s.status, uploads })
    } catch (err) {
      next(err)
    }
  })

  r.post('/sessions/:id/complete', kiosk, async (req, res, next) => {
    try {
      const { id } = req.params
      if (!ID_RE.test(id)) return bad(res, 'invalid_id')
      const s = await findSession(id)
      if (!s || s.device_code !== req.device.code) return bad(res, 'not_found', 404)
      if (s.status === 'cancelled') return bad(res, 'session_cancelled', 409)

      const have = new Set(await getStorage().listNames(id))
      const missing = SESSION_FILES.filter((n) => !have.has(n))
      if (missing.length) return res.status(409).json({ error: 'files_missing', missing })

      const db = await getDb()
      await db.query(
        `UPDATE sessions SET status = 'ready', completed_at = COALESCE(completed_at, now()),
           expires_at = now() + make_interval(days => $2)
         WHERE id = $1 AND status <> 'cancelled'`,
        [id, config.retentionDays],
      )
      res.json({ id, status: 'ready' })
    } catch (err) {
      next(err)
    }
  })

  r.delete('/sessions/:id', kiosk, async (req, res, next) => {
    try {
      const { id } = req.params
      if (!ID_RE.test(id)) return bad(res, 'invalid_id')
      const s = await findSession(id)
      // Belum pernah terdaftar (mis. batal sebelum foto pertama terkirim): anggap beres.
      if (!s) return res.status(204).end()
      if (s.device_code !== req.device.code) return bad(res, 'not_found', 404)

      const db = await getDb()
      await db.query(`UPDATE sessions SET status = 'cancelled' WHERE id = $1`, [id])
      await getStorage().removeSession(id)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  r.get('/sessions/:id/status', async (req, res, next) => {
    try {
      const { id } = req.params
      res.set('Cache-Control', 'no-store')
      if (!ID_RE.test(id)) return bad(res, 'not_found', 404)
      const s = await findSession(id)
      if (!s || s.status === 'cancelled') return bad(res, 'not_found', 404)
      if (new Date(s.expires_at) < new Date()) return res.json({ status: 'expired' })
      res.json({ status: s.status })
    } catch (err) {
      next(err)
    }
  })

  return r
}
