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
    item: 'PHOTO',
    totals: [
      ['TOTAL MOMENTS', '3 PHOTOS'],
      ['PAID', 'SMILES'],
      ['CHANGE', 'JOY'],
    ],
    footer: ['*** THANK YOU ***', 'Merry Christmas!'],
    code: 'barcode',
  },
  {
    id: 'struk-natal',
    name: 'B',
    header: 'xmas',
    item: 'GIFT',
    totals: [
      ['SUBTOTAL', '3 GIFTS'],
      ['PRICE', 'FREE'],
      ['STATUS', 'PAID'],
    ],
    footer: ['John 3:16', '*** MERRY CHRISTMAS ***'],
    code: 'barcode',
  },
  {
    id: 'struk-doodle',
    name: 'C',
    header: 'hand',
    item: 'MOMENT',
    totals: [
      ['TOTAL', '3 MOMENTS'],
      ['LAUGHS', 'UNLIMITED'],
    ],
    footer: ['Keep this receipt', 'as a memory :)'],
    code: 'qr',
  },
  {
    id: 'struk-kasir',
    name: 'D',
    header: 'stars',
    item: 'POSE',
    totals: [
      ['QTY', '3 POSES'],
      ['HUG TAX 100%', 'FREE'],
    ],
    footer: ['PHOTOGRAPHED ITEMS ARE', 'NON-REFUNDABLE'],
    code: 'barcode',
  },
]

// Contoh data untuk pratinjau (nanti diganti data asli saat cetak).
export const SAMPLE_RECEIPT = {
  no: 'CA-0024',
  date: '24/12/2026',
  time: '19:30',
}
