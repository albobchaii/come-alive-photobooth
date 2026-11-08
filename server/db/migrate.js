/*
 * Menjalankan file SQL di ./migrations secara berurutan, masing-masing sekali.
 * Dipakai: `npm run db:migrate` (sekali ke Supabase sebelum deploy), dan otomatis
 * saat server lokal menyala.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDirectDb as getDb } from './index.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const LOCK_KEY = 4210001 // angka bebas, unik untuk kunci migrasi

export async function migrate({ log = console.log } = {}) {
  const db = await getDb()
  return db.withLock(LOCK_KEY, async (tx) => {
    await tx.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    const { rows } = await tx.query('SELECT name FROM schema_migrations')
    const done = new Set(rows.map((r) => r.name))
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    let applied = 0
    for (const file of files) {
      if (done.has(file)) continue
      const sql = readFileSync(join(dir, file), 'utf8')
      await tx.exec('BEGIN')
      try {
        await tx.exec(sql)
        await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await tx.exec('COMMIT')
      } catch (err) {
        await tx.exec('ROLLBACK')
        throw new Error(`Migrasi ${file} gagal: ${err.message}`)
      }
      log(`[db] migrasi diterapkan: ${file}`)
      applied++
    }
    if (!applied) log('[db] skema sudah terbaru')
    return applied
  })
}

// Jalankan langsung: node server/db/migrate.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(async () => (await getDb()).close())
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
