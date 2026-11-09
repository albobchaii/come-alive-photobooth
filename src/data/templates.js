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
 *              | playlist | arcade | chat | forecast
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
    // Playlist Natal: kaset + daftar lagu, tiap foto jadi satu lagu.
    id: 'playlist-natal',
    name: 'G',
    layout: 'playlist',
    mix: 'Come Alive Mix',
    title: 'CHRISTMAS PLAYLIST',
    tracks: [
      ['Joy to the World', '3:16'],
      ['O Holy Night', '2:10'],
      ['Silent Night', '2:14'],
    ],
    footer: ['NOW PLAYING: YOU', 'SIDE B: SEE YOU NEXT CHRISTMAS'],
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
    // Obrolan grup: balon chat, foto dikirim sebagai pesan gambar.
    id: 'chat-natal',
    name: 'I',
    layout: 'chat',
    group: 'COME ALIVE SQUAD',
    members: 'Bethel Teens & Youth',
    thread: [
      { from: 'Grace', text: 'Where are you guys??' },
      { me: true, text: 'At the photobooth!' },
      { me: true, photo: 0 },
      { from: 'Kevin', text: 'OMG so cute!!' },
      { from: 'Kevin', photo: 1 },
      { me: true, text: 'Merry Christmas everyone!' },
      { me: true, photo: 2 },
    ],
    typing: 'Grace',
    footer: ['Merry Christmas!'],
  },
  {
    // Prakiraan cuaca Natal: 100% chance of joy.
    id: 'cuaca-natal',
    name: 'J',
    layout: 'forecast',
    title: 'CHRISTMAS FORECAST',
    place: 'BANDUNG',
    slots: [
      ['MORNING', 'Sunny smiles', 'sun', '28°'],
      ['AFTERNOON', 'Snowfall of laughter', 'snow', '24°'],
      ['EVENING', 'Starry joy', 'star', '19°'],
    ],
    extras: [
      ['HUMIDITY', '100% LOVE'],
      ['WIND', 'GENTLE PEACE'],
      ['UV INDEX', 'VERY BRIGHT'],
    ],
    footer: ['"Every good and perfect gift is from above"', 'JAMES 1:17'],
  },
]

// Contoh data untuk pratinjau (nanti diganti data asli saat cetak).
export const SAMPLE_RECEIPT = {
  no: 'CA-0024',
  date: '24/12/2026',
  time: '19:30',
}
