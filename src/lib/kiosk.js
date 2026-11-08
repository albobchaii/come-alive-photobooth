/*
 * Identitas kiosk (tablet): kode A–Z + token rahasia dari panitia.
 * Diisi sekali lewat halaman /setup, disimpan di localStorage tablet.
 * Tanpa setup, photobooth tetap jalan dalam "mode demo" (tanpa softfile).
 */
const KEY = 'photobooth.kiosk'

export function getKiosk() {
  try {
    const k = JSON.parse(localStorage.getItem(KEY))
    if (k?.code && k?.token) return k
  } catch {
    /* kosong / rusak */
  }
  return null
}

export function setKiosk(kiosk) {
  try {
    localStorage.setItem(KEY, JSON.stringify(kiosk))
    return true
  } catch {
    return false
  }
}

export function clearKiosk() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* abaikan */
  }
}

// fetch ke API dengan token kiosk.
export function kioskFetch(path, { method = 'GET', body, token, keepalive = false } = {}) {
  const t = token || getKiosk()?.token
  if (!t) return Promise.reject(new Error('kiosk_not_configured'))
  return fetch(path, {
    method,
    keepalive,
    headers: {
      'X-Device-Token': t,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}
