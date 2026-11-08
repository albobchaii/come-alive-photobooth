/*
 * Pengaturan hasil cetak: umum (tabel settings) + khusus kiosk (devices.print_settings).
 */
import { DEFAULT_PRINT_SETTINGS, normalizePrintSettings } from '../src/lib/printSettings.js'

export async function getGlobalPrintSettings(db) {
  const { rows } = await db.query(`SELECT value FROM settings WHERE key = 'print'`)
  return rows[0] ? normalizePrintSettings(rows[0].value) : { ...DEFAULT_PRINT_SETTINGS }
}

export async function saveGlobalPrintSettings(db, input) {
  const value = normalizePrintSettings(input)
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('print', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  )
  return value
}

// input null = hapus pengaturan khusus (kembali ikut pengaturan umum)
export async function saveDevicePrintSettings(db, code, input) {
  const value = input ? normalizePrintSettings(input) : null
  const { rows } = await db.query(
    'UPDATE devices SET print_settings = $2::jsonb WHERE code = $1 RETURNING code',
    [code, value ? JSON.stringify(value) : null],
  )
  return rows.length ? value : undefined
}

// Pengaturan yang berlaku untuk satu kiosk.
export async function getEffectivePrintSettings(db, code) {
  const { rows } = await db.query('SELECT print_settings FROM devices WHERE code = $1', [code])
  const own = rows[0]?.print_settings
  return own ? { settings: normalizePrintSettings(own), source: 'device' } : { settings: await getGlobalPrintSettings(db), source: 'global' }
}
