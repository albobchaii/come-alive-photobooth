/*
 * Penyimpanan softfile. Satu antarmuka, dua driver:
 *
 *  - supabase : Supabase Storage (production). Bucket private; kiosk upload
 *               lewat signed upload URL, HP unduh lewat signed URL.
 *  - local    : folder .data/uploads (development tanpa akun Supabase).
 *               Meniru alur yang sama: URL upload/unduh bertanda tangan HMAC.
 *
 * Struktur file: sessions/<id>/<nama>  (nama: foto-1.jpg … struk.jpg)
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.js'

export const SESSION_FILES = ['foto-1.jpg', 'foto-2.jpg', 'foto-3.jpg', 'struk.jpg']
export const MAX_FILE_BYTES = 3 * 1024 * 1024
const UPLOAD_TTL_S = 2 * 60 * 60 // Supabase: signed upload URL berlaku 2 jam
const DOWNLOAD_TTL_S = 60 * 60

const pathOf = (id, name) => `sessions/${id}/${name}`

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */
function supabaseDriver() {
  let bucketPromise = null
  const bucket = () =>
    (bucketPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).storage.from(config.bucket),
    ))

  return {
    kind: 'supabase',

    async uploadTargets(id, names) {
      const b = await bucket()
      const out = {}
      await Promise.all(
        names.map(async (name) => {
          const { data, error } = await b.createSignedUploadUrl(pathOf(id, name), { upsert: true })
          if (error) throw new Error(`createSignedUploadUrl ${name}: ${error.message}`)
          out[name] = { url: data.signedUrl, method: 'PUT', headers: { 'x-upsert': 'true' } }
        }),
      )
      return { files: out, expiresAt: Date.now() + UPLOAD_TTL_S * 1000 }
    },

    async listNames(id) {
      const b = await bucket()
      const { data, error } = await b.list(`sessions/${id}`, { limit: 20 })
      if (error) throw new Error(`list: ${error.message}`)
      return data.filter((f) => f.id !== null).map((f) => f.name)
    },

    async downloadUrls(id, names) {
      const b = await bucket()
      const { data, error } = await b.createSignedUrls(
        names.map((n) => pathOf(id, n)),
        DOWNLOAD_TTL_S,
      )
      if (error) throw new Error(`createSignedUrls: ${error.message}`)
      const out = {}
      data.forEach((d, i) => {
        if (!d.error && d.signedUrl) out[names[i]] = d.signedUrl
      })
      return out
    },

    async removeSession(id) {
      const b = await bucket()
      const { error } = await b.remove(SESSION_FILES.map((n) => pathOf(id, n)))
      if (error) throw new Error(`remove: ${error.message}`)
    },
  }
}

/* ------------------------------------------------------------------ */
/* Lokal (development)                                                 */
/* ------------------------------------------------------------------ */
const devSecret = process.env.DEV_STORAGE_SECRET || randomBytes(32).toString('hex')

function sign(op, id, name, exp) {
  return createHmac('sha256', devSecret).update(`${op}:${id}:${name}:${exp}`).digest('base64url')
}

export function verifyLocalSignature(op, id, name, exp, sig) {
  if (!sig || Number(exp) < Date.now() / 1000) return false
  const a = Buffer.from(sign(op, id, name, exp))
  const b = Buffer.from(String(sig))
  return a.length === b.length && timingSafeEqual(a, b)
}

export const localFilePath = (id, name) => join(config.localUploadDir, 'sessions', id, name)

export async function writeLocalFile(id, name, buf) {
  await mkdir(join(config.localUploadDir, 'sessions', id), { recursive: true })
  await writeFile(localFilePath(id, name), buf)
}

function localDriver() {
  const url = (op, id, name, ttl) => {
    const exp = Math.floor(Date.now() / 1000) + ttl
    return `/api/dev-storage/${op}/${id}/${name}?exp=${exp}&sig=${sign(op, id, name, exp)}`
  }
  return {
    kind: 'local',
    async uploadTargets(id, names) {
      const files = {}
      for (const n of names) files[n] = { url: url('upload', id, n, UPLOAD_TTL_S), method: 'PUT', headers: {} }
      return { files, expiresAt: Date.now() + UPLOAD_TTL_S * 1000 }
    },
    async listNames(id) {
      try {
        return await readdir(join(config.localUploadDir, 'sessions', id))
      } catch {
        return []
      }
    },
    async downloadUrls(id, names) {
      const out = {}
      for (const n of names) out[n] = url('file', id, n, DOWNLOAD_TTL_S)
      return out
    },
    async removeSession(id) {
      await rm(join(config.localUploadDir, 'sessions', id), { recursive: true, force: true })
    },
  }
}

let driver = null
export function getStorage() {
  if (!driver) {
    if (config.supabaseUrl && config.supabaseKey) driver = supabaseDriver()
    else if (config.isVercel) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY belum diisi')
    else driver = localDriver()
  }
  return driver
}
