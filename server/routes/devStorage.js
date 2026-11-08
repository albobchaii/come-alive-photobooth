/*
 * Penyimpanan tiruan untuk development (driver "local").
 * Meniru Supabase: PUT ke URL upload bertanda tangan, GET ke URL unduh.
 * Tidak aktif di Vercel / saat Supabase dipakai.
 */
import express from 'express'
import { MAX_FILE_BYTES, SESSION_FILES, localFilePath, verifyLocalSignature, writeLocalFile } from '../storage.js'
import { ID_RE } from './sessions.js'

export function devStorageRouter() {
  const r = express.Router()
  const valid = (op, req) =>
    ID_RE.test(req.params.id) &&
    SESSION_FILES.includes(req.params.name) &&
    verifyLocalSignature(op, req.params.id, req.params.name, req.query.exp, req.query.sig)

  r.put(
    '/dev-storage/upload/:id/:name',
    express.raw({ type: ['image/jpeg'], limit: MAX_FILE_BYTES }),
    async (req, res, next) => {
      try {
        if (!valid('upload', req)) return res.status(403).json({ error: 'invalid_signature' })
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(415).json({ error: 'jpeg_required' })
        await writeLocalFile(req.params.id, req.params.name, req.body)
        res.json({ ok: true })
      } catch (err) {
        next(err)
      }
    },
  )

  r.get('/dev-storage/file/:id/:name', (req, res) => {
    if (!valid('file', req)) return res.status(403).end()
    if (typeof req.query.download === 'string') res.attachment(req.query.download)
    res.sendFile(localFilePath(req.params.id, req.params.name), { maxAge: '1h', dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) res.status(404).end()
    })
  })

  return r
}
