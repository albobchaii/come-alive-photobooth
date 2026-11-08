/*
 * Pembersihan harian: GET /api/cron/cleanup
 * Dipanggil Vercel Cron (sekali sehari) dengan header
 * "Authorization: Bearer <CRON_SECRET>".
 *
 * Menghapus file + baris untuk:
 *  - sesi dibatalkan,
 *  - sesi menggantung (belum selesai upload > 12 jam),
 *  - sesi kedaluwarsa (lewat RETENTION_DAYS).
 */
import { timingSafeEqual } from 'node:crypto'
import express from 'express'
import { config } from '../config.js'
import { getDb } from '../db/index.js'
import { getStorage } from '../storage.js'

const BATCH = 200

function authorized(req) {
  if (!config.cronSecret) return false
  const got = Buffer.from(req.get('authorization') || '')
  const want = Buffer.from(`Bearer ${config.cronSecret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function cleanup() {
  const db = await getDb()
  const storage = getStorage()
  const { rows } = await db.query(
    `SELECT id FROM sessions
     WHERE status = 'cancelled'
        OR (status = 'uploading' AND created_at < now() - interval '12 hours')
        OR expires_at < now()
     ORDER BY created_at
     LIMIT ${BATCH}`,
  )
  let removed = 0
  const failed = []
  for (const { id } of rows) {
    try {
      await storage.removeSession(id)
      await db.query('DELETE FROM sessions WHERE id = $1', [id])
      removed++
    } catch (err) {
      failed.push(id)
      console.error('[cron] gagal hapus', id, err.message)
    }
  }
  return { removed, failed: failed.length, more: rows.length === BATCH }
}

export function cronRouter() {
  const r = express.Router()
  r.get('/cron/cleanup', async (req, res, next) => {
    if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' })
    try {
      res.json(await cleanup())
    } catch (err) {
      next(err)
    }
  })
  return r
}
