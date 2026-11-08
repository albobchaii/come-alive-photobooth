/*
 * Buat bucket Supabase Storage untuk softfile (sekali saja):
 *   npm run storage:setup
 * Bucket private, maks 3 MB per file, hanya JPEG.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'
import { MAX_FILE_BYTES } from '../storage.js'

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('Isi SUPABASE_URL dan SUPABASE_SECRET_KEY di .env dulu.')
  process.exit(1)
}

const storage = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false },
}).storage
const options = { public: false, fileSizeLimit: MAX_FILE_BYTES, allowedMimeTypes: ['image/jpeg'] }

const { data: existing } = await storage.getBucket(config.bucket)
const { error } = existing
  ? await storage.updateBucket(config.bucket, options)
  : await storage.createBucket(config.bucket, options)

if (error) {
  console.error('Gagal:', error.message)
  process.exit(1)
}
console.log(`Bucket "${config.bucket}" ${existing ? 'diperbarui' : 'dibuat'} (private, maks 3 MB, JPEG).`)
