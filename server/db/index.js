/*
 * Koneksi database dengan satu antarmuka:
 *   db.query(sql, params) → { rows }
 *   db.exec(sql)          → jalankan beberapa perintah sekaligus (migrasi)
 *
 * Production (Railway): Postgres lewat DATABASE_URL.
 * Lokal tanpa DATABASE_URL: PGlite (Postgres yang berjalan di Node),
 * SQL-nya sama persis, jadi tidak perlu install Postgres/Docker.
 */
import { mkdirSync } from 'node:fs'
import { config } from '../config.js'

let dbPromise = null

async function connectPg(url) {
  const { default: pg } = await import('pg')
  const useSsl = process.env.PGSSL === '1' || /supabase\.(co|com)/.test(url)
  const pool = new pg.Pool({
    connectionString: url,
    // Serverless: tiap instance cukup sedikit koneksi; pooler Supabase
    // yang membagi koneksi ke database.
    max: config.isVercel ? 3 : 10,
    idleTimeoutMillis: 10_000,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  })
  pool.on('error', (err) => console.error('[db] koneksi idle error:', err.message))
  return {
    kind: 'postgres',
    query: (text, params) => pool.query(text, params),
    exec: (text) => pool.query(text),
    // Kunci global supaya migrasi tidak jalan dobel bila ada 2 replika.
    async withLock(key, fn) {
      const client = await pool.connect()
      try {
        await client.query('SELECT pg_advisory_lock($1)', [key])
        return await fn({
          query: (t, p) => client.query(t, p),
          exec: (t) => client.query(t),
        })
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => {})
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

async function connectPglite() {
  const { PGlite } = await import('@electric-sql/pglite')
  mkdirSync(config.pgliteDir, { recursive: true })
  const pg = await PGlite.create(config.pgliteDir)
  return {
    kind: 'pglite',
    query: (text, params) => pg.query(text, params),
    exec: (text) => pg.exec(text),
    withLock: (_key, fn) => fn({ query: (t, p) => pg.query(t, p), exec: (t) => pg.exec(t) }),
    close: () => pg.close(),
  }
}

export function getDb() {
  if (!dbPromise) dbPromise = config.databaseUrl ? connectPg(config.databaseUrl) : connectPglite()
  return dbPromise
}

// Koneksi khusus migrasi/skrip: memakai URL "direct/session" karena kunci
// advisory tidak bekerja lewat pooler mode transaction.
let directPromise = null
export function getDirectDb() {
  if (!config.databaseUrl) return getDb()
  if (!directPromise) directPromise = connectPg(config.databaseUrlDirect)
  return directPromise
}
