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
 * - layout   : receipt (struk belanja, bawaan) | polaroid | film | comic | ticket (boarding pass) | news (koran)
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
    // Kartu Natal: foto dalam bingkai polaroid, ada kolom To/From untuk ditulisi.
    id: 'polaroid-natal',
    name: 'B',
    layout: 'polaroid',
    title: 'Merry Christmas',
    captions: ['joy!', 'peace!', 'love!'],
    footer: ['PEACE ON EARTH', 'Luke 2:14'],
  },
  {
    // Roll film 35mm dengan lubang sprocket di kedua sisi.
    id: 'film-natal',
    name: 'C',
    layout: 'film',
    brand: 'COME ALIVE FILM',
    stock: 'CHRISTMAS 2026 · ISO 2412',
    edge: 'CA 2026',
    footer: ['~ DEVELOPED WITH JOY ~', 'Merry Christmas!'],
  },
  {
    // Komik: tiap foto jadi panel dengan kotak narasi dan balon kata.
    id: 'komik-natal',
    name: 'D',
    layout: 'comic',
    title: 'COME ALIVE',
    banner: 'COMICS',
    issue: 'CHRISTMAS SPECIAL',
    boxes: ['MEANWHILE, AT BETHEL...', 'SUDDENLY...', 'AND THEN...'],
    bubbles: ['Ready?', 'Say cheese!', 'Merry Christmas!'],
    footer: ['To be continued...', 'CHRISTMAS 2027'],
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
