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
 * Template.
 * - layout   : receipt (struk belanja, bawaan) | ticket (boarding pass) | news (halaman koran)
 *
 * Khusus layout receipt:
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
  {
    // Boarding pass: penerbangan Natal ke Betlehem, dengan sobekan tiket di bawah.
    id: 'tiket-betlehem',
    name: 'E',
    layout: 'ticket',
    airline: 'COME ALIVE AIR',
    route: [
      ['BDG', 'BANDUNG'],
      ['BTH', 'BETHLEHEM'],
    ],
    fields: [
      ['FLIGHT', 'CA2412'],
      ['GATE', 'B26'],
      ['SEAT', '1A'],
    ],
    passenger: 'BETHEL TEENS & YOUTH',
    item: 'BOARDING',
    footer: ['FOLLOW THE STAR', 'Matthew 2:10'],
    code: 'barcode',
  },
  {
    // Halaman depan koran: foto jadi berita utama.
    id: 'koran-natal',
    name: 'F',
    layout: 'news',
    masthead: 'The Bethel Times',
    headline: ['JOY TO THE', 'WORLD!'],
    deck: 'Bethel Teens & Youth come alive this Christmas',
    captions: ['Smiles spotted all over Bandung.', 'Joy: off the charts', 'Friends shine bright'],
    ears: [
      ['WEATHER', '100% JOY'],
      ['PRICE', 'FREE'],
    ],
    footer: ['"Good news of great joy"', 'LUKE 2:10'],
  },
]

// Contoh data untuk pratinjau (nanti diganti data asli saat cetak).
export const SAMPLE_RECEIPT = {
  no: 'CA-0024',
  date: '24/12/2026',
  time: '19:30',
}
