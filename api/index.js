/*
 * Titik masuk Vercel Function. Semua request /api/* dan /s/* diarahkan ke
 * sini oleh vercel.json, lalu ditangani aplikasi Express yang sama dengan
 * server lokal. Migrasi TIDAK dijalankan di sini: pakai `npm run db:migrate`.
 */
import { createApp } from '../server/app.js'

export default createApp()
