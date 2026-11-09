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
 * - layout   : receipt (struk belanja, bawaan) | polaroid | postcard | calendar | ticket | news
 *              | carol (lembar lagu) | arcade | certificate | wanted
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
    // Kartu pos: perangko + cap pos, kolom pesan dan alamat untuk ditulisi.
    id: 'kartupos-natal',
    name: 'C',
    layout: 'postcard',
    place: 'COME ALIVE',
    address: ['BETHEL TEENS', '& YOUTH', 'BANDUNG, ID'],
    footer: ['MERRY CHRISTMAS', '& HAPPY NEW YEAR'],
  },
  {
    // Halaman kalender: tanggal besar + kalender mini (otomatis dari tanggal foto) + to-do list.
    id: 'kalender-natal',
    name: 'D',
    layout: 'calendar',
    date: '05/12/2026', // tanggal yang tampil di kalender (tetap, bukan tanggal foto)
    tagline: 'COME ALIVE · CHRISTMAS 2026',
    todos: ['Smile together', 'Laugh out loud', 'Celebrate Jesus'],
    footer: ['"This is the day the Lord has made"', 'PSALM 118:24'],
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
  {
    // Lembar lagu: paranada + not "Joy to the World" (melodi asli) di atas tiap foto.
    id: 'lagu-natal',
    name: 'G',
    layout: 'carol',
    title: 'Joy to the World',
    subtitle: 'CAROL No. 26 · COME ALIVE',
    lyrics: ['Joy to the world! the Lord is come', 'Let earth receive her King', "And heav'n and nature sing"],
    // posisi not pada paranada: 0 = garis teratas (F5) … 8 = garis terbawah (E4), 10 = C4
    notes: [
      [3, 4, 5, 6, 7, 8, 9, 10],
      [6, 5, 5, 4, 4, 3],
      [3, 3, 4, 5, 6, 6, 7, 8],
    ],
    footer: ['Isaac Watts, 1719', 'PSALM 98'],
  },
  {
    // Game arcade: skor, nyawa, level.
    id: 'arcade-natal',
    name: 'H',
    layout: 'arcade',
    title: 'COME ALIVE',
    edition: 'CHRISTMAS EDITION',
    levels: ['SMILE', 'LAUGH', 'JOY'],
    footer: ['INSERT JOY TO PLAY AGAIN'],
  },
  {
    // Sertifikat resmi dengan segel dan tanda tangan.
    id: 'sertifikat-natal',
    name: 'I',
    layout: 'certificate',
    title: ['CERTIFICATE', 'of', 'JOY'],
    lines: ['This certifies that', 'has officially come alive at the Christmas Celebration 2026'],
    signers: ['Pastor', 'Date'],
  },
  {
    // Poster "WANTED" ala koboi, versi Natal.
    id: 'wanted-natal',
    name: 'J',
    layout: 'wanted',
    charge: 'FOR SPREADING TOO MUCH JOY',
    notes: ['Armed with a smile', 'Highly joyful', 'Dangerously kind'],
    reward: 'ENDLESS HUGS',
    seen: 'Last seen at the Christmas Celebration 2026, Bandung',
    footer: ['APPROACH WITH A SMILE'],
  },
]

// Contoh data untuk pratinjau (nanti diganti data asli saat cetak).
export const SAMPLE_RECEIPT = {
  no: 'CA-0024',
  date: '24/12/2026',
  time: '19:30',
}
