/*
 * Titik masuk server: `npm start` (production) / `npm run dev:server` (lokal).
 */
import { config } from './config.js'
import { getDb } from './db/index.js'
import { migrate } from './db/migrate.js'
import { createApp } from './app.js'

const db = await getDb()

// Di lokal (PGlite) migrasi otomatis. Di Railway pakai `npm run db:migrate`
// sebagai Pre-deploy command, supaya tidak berjalan dari tiap replika.
if (db.kind === 'pglite' || process.env.MIGRATE_ON_START === '1') await migrate()

const server = createApp().listen(config.port, () => {
  console.log(`[server] jalan di http://localhost:${config.port} (db: ${db.kind})`)
})

// Railway mengirim SIGTERM saat deploy ulang: selesaikan request lalu tutup.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.once(sig, () => {
    server.close(async () => {
      await db.close().catch(() => {})
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 10_000).unref()
  })
}
