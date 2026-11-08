import { Link } from 'react-router-dom'
import { clearSession, peekSessionId } from '../lib/session.js'
import { cancelSoftfile } from '../lib/softfile.js'

// Tombol "Batal" di kiri atas: hapus sesi (juga foto di server) lalu ke beranda.
export default function CancelButton() {
  return (
    <Link
      to="/"
      className="back"
      onClick={() => {
        cancelSoftfile(peekSessionId())
        clearSession()
      }}
    >
      <span aria-hidden="true">✕</span> Cancel
    </Link>
  )
}
