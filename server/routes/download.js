/*
 * Halaman unduhan softfile: GET /s/:id
 *
 * Dibuka dari HP pengunjung setelah scan QR. Sengaja dibuat sangat ringan
 * (HTML + CSS + sedikit JS, tanpa React/font eksternal) supaya cepat
 * terbuka walau pakai data seluler. Foto diambil langsung dari storage.
 */
import express from 'express'
import { getDb } from '../db/index.js'
import { SESSION_FILES, getStorage } from '../storage.js'
import { ID_RE } from './sessions.js'

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const CSS = `
:root{--ink:#c8102e;--paper:#fffaf2;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:520px;margin:0 auto;padding:24px 16px 40px;text-align:center}
.brand{font-weight:800;letter-spacing:.02em;font-size:.95rem;margin:0}
h1{font-size:2rem;line-height:1.1;margin:10px 0 4px;transform:rotate(-2deg)}
.meta{margin:0 0 18px;font:600 .85rem ui-monospace,Menlo,monospace;opacity:.8}
.btn{display:inline-block;width:100%;max-width:340px;padding:14px 20px;border:0;border-radius:999px;background:var(--ink);color:var(--paper);font:800 1.1rem system-ui,sans-serif;box-shadow:3px 4px 0 rgba(0,0,0,.18);cursor:pointer}
.btn:disabled{opacity:.6}
.hint{font-size:.85rem;margin:10px 0 22px;opacity:.85}
.receipt{display:block;width:100%;max-width:300px;margin:0 auto;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.photos{display:grid;gap:12px}
.photos img{width:100%;height:auto;display:block;border:2.5px solid var(--ink);border-radius:12px;background:#fff}
h2{font-size:1rem;margin:28px 0 12px}
figure{margin:0 0 22px}
.photos figure{margin:0}
.dl{display:inline-block;margin-top:8px;padding:9px 18px;border:2px solid var(--ink);border-radius:999px;color:var(--ink);font-weight:800;font-size:.95rem;text-decoration:none;background:#fff}
.dl:active{background:var(--ink);color:var(--paper)}
.box{margin-top:40px}
.spin{width:44px;height:44px;margin:0 auto 16px;border:5px solid rgba(200,16,46,.2);border-top-color:var(--ink);border-radius:50%;animation:s 1s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
footer{margin-top:32px;font-size:.75rem;opacity:.7}
`

function page({ title, body, script = '' }) {
  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#fffaf2">
<title>${esc(title)} · Come Alive PhotoBooth</title>
<style>${CSS}</style>
</head><body><main>
<p class="brand">COME ALIVE · PHOTOBOOTH</p>
${body}
<footer>Bethel Teens &amp; Youth · Christmas Celebration 2026</footer>
</main>${script ? `<script>${script}</script>` : ''}</body></html>`
}

const messagePage = (title, text) =>
  page({ title, body: `<div class="box"><h1>${esc(title)}</h1><p class="hint">${esc(text)}</p></div>` })

function waitingPage(id) {
  // Cek status tiap 1,5 detik, muat ulang begitu foto siap.
  const script = `(function(){var n=0;function t(){fetch('/api/sessions/${id}/status',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(d){if(d&&d.status!=='uploading'){location.reload()}else if(++n<400){setTimeout(t,1500)}}).catch(function(){setTimeout(t,3000)})}setTimeout(t,1500)})()`
  return page({
    title: 'Sedang disiapkan',
    body: `<div class="box"><div class="spin" aria-hidden="true"></div><h1>Foto sedang disiapkan…</h1><p class="hint">Halaman ini akan terbuka otomatis. Jangan ditutup ya.</p></div>`,
    script,
  })
}

// URL yang memaksa unduhan (Content-Disposition: attachment) dengan nama file rapi.
const downloadUrl = (url, name) => `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(name)}`

function readyPage(s, urls) {
  const no = esc(s.receipt_no)
  const file = (n) => ({ url: urls[n], dl: downloadUrl(urls[n], `ComeAlive-${s.receipt_no}-${n}`), name: `ComeAlive-${s.receipt_no}-${n}` })
  const files = SESSION_FILES.filter((n) => urls[n]).map(file)
  const photos = SESSION_FILES.filter((n) => n.startsWith('foto-') && urls[n]).map(file)
  const receipt = urls['struk.jpg'] ? file('struk.jpg') : null
  const dlLink = (f, label) => `<a class="dl" href="${esc(f.dl)}" download="${esc(f.name)}">⬇ ${label}</a>`

  // Simpan Semua: Android/desktop → unduh langsung ke folder Download (tampil di Galeri).
  // iPhone/iPad → lembar Bagikan, karena hanya dari situ foto bisa masuk ke app Foto.
  const script = `(function(){var F=${JSON.stringify(files).replace(/</g, '\\u003c')};var b=document.getElementById('save'),h=document.getElementById('hint');
var ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function done(t){h.textContent=t;b.disabled=false;b.textContent='Unduh Gambar'}
function direct(){F.forEach(function(f,i){setTimeout(function(){var a=document.createElement('a');a.href=f.dl;a.download=f.name;document.body.appendChild(a);a.click();a.remove()},i*700)});setTimeout(function(){done('Foto tersimpan di folder Download / Galeri.')},F.length*700)}
function share(){return Promise.all(F.map(function(f){return fetch(f.url).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(x){return new File([x],f.name,{type:'image/jpeg'})})})).then(function(files){if(!(navigator.canShare&&navigator.canShare({files:files})))throw 0;return navigator.share({files:files,title:'Come Alive PhotoBooth'}).then(function(){done('Pilih Simpan Gambar untuk menyimpan ke Foto.')},function(){done('')})})}
b.addEventListener('click',function(){b.disabled=true;b.textContent='Mengunduh…';if(ios){share().catch(function(){done('Tekan tombol Unduh di bawah tiap foto.')})}else{direct()}})})()`
  return page({
    title: `Foto ${s.receipt_no}`,
    body: `<h1>Foto Kalian!</h1>
<p class="meta">${no}</p>
<button id="save" class="btn" type="button">Unduh Gambar</button>
<p id="hint" class="hint">Atau tekan <b>Unduh</b> di bawah tiap foto.</p>
${receipt ? `<figure><img class="receipt" src="${esc(receipt.url)}" alt="Struk ${no}">${dlLink(receipt, 'Unduh struk')}</figure>` : ''}
<h2>Foto asli</h2>
<div class="photos">${photos.map((f, i) => `<figure><img src="${esc(f.url)}" alt="Foto ${i + 1}" loading="${i ? 'lazy' : 'eager'}" width="960" height="720">${dlLink(f, `Unduh foto ${i + 1}`)}</figure>`).join('')}</div>`,
    script,
  })
}

export function downloadRouter() {
  const r = express.Router()

  r.get('/s/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      res.set({
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer',
        'Content-Type': 'text/html; charset=utf-8',
      })
      const notFound = () =>
        res
          .status(404)
          .set('Cache-Control', 'no-store')
          .send(messagePage('Foto tidak ditemukan', 'Coba scan ulang QR code dari layar photobooth.'))

      if (!ID_RE.test(id)) return notFound()
      const db = await getDb()
      const { rows } = await db.query(
        'SELECT id, receipt_no, status, expires_at FROM sessions WHERE id = $1',
        [id],
      )
      const s = rows[0]
      if (!s || s.status === 'cancelled') return notFound()
      if (new Date(s.expires_at) < new Date())
        return res
          .status(410)
          .set('Cache-Control', 'no-store')
          .send(messagePage('Link sudah kedaluwarsa', 'Masa simpan foto ini sudah habis.'))
      if (s.status !== 'ready') return res.set('Cache-Control', 'no-store').send(waitingPage(id))

      const urls = await getStorage().downloadUrls(id, SESSION_FILES)
      // URL foto berlaku 1 jam; halaman boleh di-cache sebentar di HP.
      res.set('Cache-Control', 'private, max-age=300').send(readyPage(s, urls))
    } catch (err) {
      next(err)
    }
  })

  return r
}
