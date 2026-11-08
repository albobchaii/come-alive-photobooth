/*
 * Kelola perangkat kiosk dari terminal.
 *
 *   npm run device -- add A "Kiosk A"   daftarkan kiosk, tampilkan token (sekali saja!)
 *   npm run device -- list              daftar kiosk
 *   npm run device -- rotate A          buat token baru (token lama langsung mati)
 *   npm run device -- disable A         nonaktifkan kiosk (mis. tablet hilang)
 *   npm run device -- enable A          aktifkan lagi
 *
 * Ke database Supabase: isi DATABASE_URL (dan DATABASE_URL_DIRECT) di .env dulu.
 */
import { getDirectDb as getDb } from '../db/index.js'
import { migrate } from '../db/migrate.js'
import { CODE_RE, addDevice, cleanName, listDevices, rotateDevice, setDeviceActive } from '../devices.js'

const [cmd, rawCode, ...nameParts] = process.argv.slice(2)
const code = rawCode?.toUpperCase()
const fail = (msg) => {
  console.error(msg)
  process.exitCode = 1
}

function needCode() {
  if (!code || !CODE_RE.test(code)) throw new Error('Kode kiosk harus 1 huruf A–Z, mis. A')
}

function showToken(token) {
  console.log('\n  Token kiosk ' + code + ' (simpan sekarang, tidak bisa dilihat lagi):\n')
  console.log('  ' + token + '\n')
}

const db = await getDb()
try {
  if (db.kind === 'pglite') await migrate({ log: () => {} })

  switch (cmd) {
    case 'add': {
      needCode()
      const name = cleanName(nameParts.join(' '), code)
      const token = await addDevice(db, code, name)
      if (!token) {
        fail(`Kiosk ${code} sudah terdaftar. Pakai "rotate ${code}" untuk token baru.`)
        break
      }
      console.log(`Kiosk ${code} (${name}) terdaftar.`)
      showToken(token)
      break
    }
    case 'rotate': {
      needCode()
      const token = await rotateDevice(db, code)
      if (!token) {
        fail(`Kiosk ${code} belum terdaftar.`)
        break
      }
      console.log(`Token kiosk ${code} diganti. Token lama sudah tidak berlaku.`)
      showToken(token)
      break
    }
    case 'disable':
    case 'enable': {
      needCode()
      const found = await setDeviceActive(db, code, cmd === 'enable')
      if (!found) fail(`Kiosk ${code} belum terdaftar.`)
      else console.log(`Kiosk ${code} ${cmd === 'enable' ? 'diaktifkan' : 'dinonaktifkan'}.`)
      break
    }
    case 'list': {
      const rows = await listDevices(db)
      if (!rows.length) console.log('Belum ada kiosk. Tambah: npm run device -- add A "Kiosk A"')
      for (const r of rows) {
        const seen = r.last_seen ? new Date(r.last_seen).toLocaleString('id-ID') : '-'
        console.log(`${r.code}  ${r.active ? 'aktif   ' : 'nonaktif'}  ${r.name.padEnd(16)} terakhir online: ${seen}`)
      }
      break
    }
    default:
      fail('Perintah: add <KODE> [nama] | list | rotate <KODE> | disable <KODE> | enable <KODE>')
  }
} catch (err) {
  fail(err.message)
} finally {
  await db.close()
}
