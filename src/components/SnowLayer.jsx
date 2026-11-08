import { useMemo } from 'react'
import { Snowflake } from './Doodles.jsx'

export default function SnowLayer({ count = 14 }) {
  // Posisi acak tapi stabil selama komponen hidup.
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 10 + Math.random() * 14,
        duration: 12 + Math.random() * 14,
        delay: -Math.random() * 20,
        drift: (Math.random() - 0.5) * 80,
      })),
    [count],
  )

  return (
    <div className="snow" aria-hidden="true">
      {flakes.map((f) => (
        <Snowflake
          key={f.id}
          className="snow__flake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
