/*
 * Spesifikasi cetak: printer thermal, kertas 58 mm.
 * Area cetak efektif ±48 mm = 384 titik (203 dpi), ±32 karakter per baris.
 * Hanya hitam-putih: desain garis/teks hitam di atas putih, hindari blok hitam besar.
 */
export const PRINT = {
  paperMm: 58,
  printableMm: 48,
  dpi: 203,
  widthDots: 384,
  photosPerStrip: 3,
  photoAspect: 4 / 3, // landscape, muat 2–4 orang per foto
}

/*
 * Template bergaya struk belanja.
 * - header   : gaya kop (plain | xmas | hand | stars)
 * - item     : label tiap foto, mis. FOTO #1
 * - totals   : baris [kiri, kanan] di bagian total
 * - footer   : baris penutup
 * - code     : barcode | qr
 *
 * Tanggal, jam, dan nomor struk diisi otomatis saat foto dicetak.
 */
// Nama "kasir" yang tercetak di semua struk.
export const CASHIER = 'GBI Bethel Bandung'

export const TEMPLATES = [
  {
    id: 'struk-klasik',
    name: 'A',
    header: 'plain',
    item: 'FOTO',
    totals: [
      ['TOTAL MOMEN', '3 FOTO'],
      ['BAYAR', 'SENYUM'],
      ['KEMBALI', 'SUKACITA'],
    ],
    footer: ['*** TERIMA KASIH ***', 'Merry Christmas!'],
    code: 'barcode',
  },
  {
    id: 'struk-natal',
    name: 'B',
    header: 'xmas',
    item: 'KADO',
    totals: [
      ['SUBTOTAL', '3 KADO'],
      ['HARGA', 'GRATIS'],
      ['STATUS', 'LUNAS'],
    ],
    footer: ['Yohanes 3:16', '*** SELAMAT NATAL ***'],
    code: 'barcode',
  },
  {
    id: 'struk-doodle',
    name: 'C',
    header: 'hand',
    item: 'MOMEN',
    totals: [
      ['TOTAL', '3 MOMEN'],
      ['TAWA', 'TAK TERHINGGA'],
    ],
    footer: ['Simpan struk ini', 'sebagai kenangan :)'],
    code: 'qr',
  },
  {
    id: 'struk-kasir',
    name: 'D',
    header: 'stars',
    item: 'POSE',
    totals: [
      ['QTY', '3 POSE'],
      ['PPN PELUK 100%', 'GRATIS'],
    ],
    footer: ['BARANG YANG SUDAH DIFOTO', 'TIDAK DAPAT DIKEMBALIKAN'],
    code: 'barcode',
  },
]

// Contoh data untuk pratinjau (nanti diganti data asli saat cetak).
export const SAMPLE_RECEIPT = {
  no: 'CA-0024',
  date: '24/12/2026',
  time: '19:30',
}
