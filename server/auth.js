/*
 * Autentikasi kiosk.
 * Setiap tablet punya token sendiri, dikirim di header `X-Device-Token`.
 * Database hanya menyimpan hash SHA-256 token, jadi kalau database bocor
 * token aslinya tidak ikut bocor. Token berisi 32 byte acak, sehingga
 * SHA-256 biasa sudah cukup (tidak perlu bcrypt).
 */
import { createHash, randomBytes } from 'node:crypto'
import { getDb } from './db/index.js'

export const TOKEN_PREFIX = 'ca_dev_'

export function newDeviceToken() {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

const looksLikeToken = (t) => typeof t === 'string' && t.startsWith(TOKEN_PREFIX) && t.length < 100

// Middleware: isi req.device = { code, name } atau tolak dengan 401.
export async function requireDevice(req, res, next) {
  try {
    const token = req.get('x-device-token')
    if (!looksLikeToken(token)) return res.status(401).json({ error: 'device_token_required' })

    const db = await getDb()
    const { rows } = await db.query('SELECT code, name, active FROM devices WHERE token_hash = $1', [
      hashToken(token),
    ])
    const device = rows[0]
    if (!device) return res.status(401).json({ error: 'device_token_invalid' })
    if (!device.active) return res.status(403).json({ error: 'device_disabled' })

    req.device = { code: device.code, name: device.name }
    // Catat "terakhir online" (paling sering tiap 30 detik) untuk panel admin.
    await db.query(
      `UPDATE devices SET last_seen = now()
       WHERE code = $1 AND (last_seen IS NULL OR last_seen < now() - interval '30 seconds')`,
      [device.code],
    )
    next()
  } catch (err) {
    next(err)
  }
}
