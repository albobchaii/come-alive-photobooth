/*
 * Login admin dengan satu password (ADMIN_PASSWORD di environment).
 * Sesi disimpan di cookie bertanda tangan (HMAC), httpOnly + SameSite=Strict,
 * berlaku 12 jam. Mengganti ADMIN_PASSWORD otomatis mengeluarkan semua sesi.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { config } from './config.js'

const COOKIE = 'ca_admin'
const TTL_MS = 12 * 60 * 60 * 1000

const key = () => createHash('sha256').update(`ca-admin-session:${config.adminPassword}`).digest()
const sign = (exp) => createHmac('sha256', key()).update(String(exp)).digest('base64url')

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

export const adminEnabled = () => config.adminPassword.length >= 12

export function checkPassword(input) {
  if (!adminEnabled() || typeof input !== 'string') return false
  // bandingkan hash supaya panjang selalu sama (tidak bocor lewat waktu)
  const h = (s) => createHash('sha256').update(s).digest('hex')
  return safeEqual(h(input), h(config.adminPassword))
}

function readCookie(req) {
  const raw = req.get('cookie') || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return decodeURIComponent(v.join('='))
  }
  return ''
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: config.isVercel || process.env.NODE_ENV === 'production',
  path: '/api/admin',
})

export function startAdminSession(res) {
  const exp = Date.now() + TTL_MS
  res.cookie(COOKIE, `${exp}.${sign(exp)}`, { ...cookieOptions(), maxAge: TTL_MS })
}

export function endAdminSession(res) {
  res.clearCookie(COOKIE, cookieOptions())
}

export function isAdmin(req) {
  if (!adminEnabled()) return false
  const [exp, sig] = readCookie(req).split('.')
  return Number(exp) > Date.now() && safeEqual(sig || '', sign(exp))
}

export function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store')
  if (!adminEnabled()) return res.status(503).json({ error: 'admin_disabled' })
  if (!isAdmin(req)) return res.status(401).json({ error: 'admin_login_required' })
  next()
}
