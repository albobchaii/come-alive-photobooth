import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Hook kamera: menyalakan kamera depan, menempelkannya ke <video>,
 * dan mematikannya otomatis saat halaman ditinggalkan.
 *
 * status: 'loading' | 'ready' | 'error'
 * error : pesan yang ramah untuk ditampilkan
 */
export default function useCamera() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const attempt = useRef(0) // permintaan kamera yang terbaru
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    attempt.current++
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    stop()
    const id = attempt.current
    setStatus('loading')
    setError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError(
        window.isSecureContext
          ? 'This browser does not support the camera. Try the latest Chrome or Safari.'
          : 'The camera only works over HTTPS or localhost.',
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      })
      // Halaman sudah ditinggalkan / dicoba ulang selagi menunggu izin
      if (id !== attempt.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      setStatus('ready')
    } catch (err) {
      if (id !== attempt.current) return
      setStatus('error')
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError')
        setError('Camera permission was denied. Allow camera access in your browser settings, then try again.')
      else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError')
        setError('No camera found. Make sure a camera is connected.')
      else if (err?.name === 'NotReadableError')
        setError('The camera is being used by another app. Close that app, then try again.')
      else setError('Could not start the camera. Please try again.')
    }
  }, [stop])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  return { videoRef, status, error, retry: start }
}

/*
 * Ambil satu frame dari video: dipotong tengah ke rasio `aspect`,
 * dicerminkan (seperti tampilan di layar), dikembalikan sebagai JPEG data URL.
 * Foto disimpan berwarna; konversi hitam-putih untuk printer dilakukan saat cetak.
 */
export function captureFrame(video, aspect, outWidth = 960) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return null

  let sw = vw
  let sh = vw / aspect
  if (sh > vh) {
    sh = vh
    sw = vh * aspect
  }
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = Math.round(outWidth / aspect)
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}
