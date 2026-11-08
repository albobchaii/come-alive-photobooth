/*
 * Semua pengaturan server dibaca dari environment variable.
 * Lokal: salin .env.example → .env. Vercel: Project → Settings → Environment Variables.
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env

export const config = {
  root,
  port: Number(env.PORT) || 3001,
  isVercel: Boolean(env.VERCEL),

  // Postgres sungguhan (Supabase). Kosong → PGlite lokal di .data/pglite.
  // DATABASE_URL: pooler "Transaction" (port 6543) untuk server/Vercel.
  // DATABASE_URL_DIRECT: pooler "Session" (port 5432) untuk migrasi.
  databaseUrl: env.DATABASE_URL || '',
  databaseUrlDirect: env.DATABASE_URL_DIRECT || env.DATABASE_URL || '',
  pgliteDir: resolve(root, env.PGLITE_DIR || '.data/pglite'),

  // Penyimpanan foto: Supabase Storage bila SUPABASE_URL diisi, selain itu
  // folder lokal .data/uploads (khusus development).
  supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
  supabaseKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
  bucket: env.SUPABASE_BUCKET || 'softfile',
  localUploadDir: resolve(root, env.LOCAL_UPLOAD_DIR || '.data/uploads'),

  // Folder hasil `vite build` (hanya dipakai saat server dijalankan sendiri;
  // di Vercel file statis dilayani langsung oleh Vercel).
  distDir: resolve(root, 'dist'),

  // Berapa hari softfile disimpan sebelum dihapus.
  retentionDays: Number(env.RETENTION_DAYS) || 30,

  // Password panel admin (/admin). Minimal 12 karakter; kosong = admin mati.
  adminPassword: env.ADMIN_PASSWORD || '',

  // Rahasia untuk endpoint cron (Vercel mengirim "Authorization: Bearer <CRON_SECRET>").
  cronSecret: env.CRON_SECRET || '',
}
