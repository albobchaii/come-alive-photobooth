/*
 * Operasi data kiosk, dipakai bersama oleh panel admin dan skrip terminal.
 * Semua fungsi menerima `db` supaya skrip bisa memakai koneksi langsung.
 */
import { hashToken, newDeviceToken } from './auth.js'

export const CODE_RE = /^[A-Z]$/
export const cleanName = (name, code) => String(name || '').trim().slice(0, 40) || `Kiosk ${code}`

// → token baru, atau null bila kode sudah dipakai
export async function addDevice(db, code, name) {
  const token = newDeviceToken()
  const { rows } = await db.query(
    `INSERT INTO devices (code, name, token_hash) VALUES ($1, $2, $3)
     ON CONFLICT (code) DO NOTHING RETURNING code`,
    [code, cleanName(name, code), hashToken(token)],
  )
  return rows.length ? token : null
}

// → token baru (token lama langsung mati), atau null bila kiosk tidak ada
export async function rotateDevice(db, code) {
  const token = newDeviceToken()
  const { rows } = await db.query('UPDATE devices SET token_hash = $2 WHERE code = $1 RETURNING code', [
    code,
    hashToken(token),
  ])
  return rows.length ? token : null
}

export async function setDeviceActive(db, code, active) {
  const { rows } = await db.query('UPDATE devices SET active = $2 WHERE code = $1 RETURNING code', [code, active])
  return rows.length > 0
}

export async function renameDevice(db, code, name) {
  const { rows } = await db.query('UPDATE devices SET name = $2 WHERE code = $1 RETURNING code', [
    code,
    cleanName(name, code),
  ])
  return rows.length > 0
}

export async function listDevices(db) {
  const { rows } = await db.query(
    `SELECT d.code, d.name, d.active, d.last_seen, d.print_settings,
            (SELECT count(*)::int FROM sessions s
              WHERE s.device_code = d.code AND s.status = 'ready'
                AND s.created_at > now() - interval '24 hours') AS sessions_24h,
            (SELECT max(s.created_at) FROM sessions s WHERE s.device_code = d.code) AS last_session_at
     FROM devices d ORDER BY d.code`,
  )
  return rows
}
