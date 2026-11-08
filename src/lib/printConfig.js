/*
 * Pengaturan hasil cetak di tablet: diambil dari server (diatur di panel
 * admin), disimpan di localStorage supaya tetap jalan saat internet putus.
 */
import { getKiosk, kioskFetch } from './kiosk.js'
import { DEFAULT_PRINT_SETTINGS, normalizePrintSettings } from './printSettings.js'

const KEY = 'photobooth.printSettings'

export function getPrintSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved) return normalizePrintSettings(saved)
  } catch {
    /* kosong / rusak */
  }
  return { ...DEFAULT_PRINT_SETTINGS }
}

// Ambil versi terbaru dari server; gagal/lambat → pakai yang tersimpan.
export async function refreshPrintSettings({ timeoutMs = 2500 } = {}) {
  if (!getKiosk()) return getPrintSettings()
  try {
    const res = await Promise.race([
      kioskFetch('/api/kiosk/config'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
    if (!res.ok) return getPrintSettings()
    const settings = normalizePrintSettings((await res.json()).print)
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* abaikan */
    }
    return settings
  } catch {
    return getPrintSettings()
  }
}
