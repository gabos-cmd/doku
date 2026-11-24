import type { CSSProperties, ReactNode } from 'react'
import type { FolderColor } from './store'

/** Four stops per folder colour: hot → mid → haze → cool counter-tone. */
const PALETTES: Record<FolderColor, string[]> = {
  orange: ['#ff6418', '#f1946a', '#e8cdbb', '#d5c4ef'],
  blue: ['#3a66ff', '#86a6ff', '#cfd8f4', '#ebcfe6'],
  yellow: ['#f5ae00', '#f7d36b', '#efe4c4', '#cdd8f0'],
  lavender: ['#8d68f0', '#b9a2f2', '#e2d4f1', '#f7cdbd'],
  green: ['#22a862', '#8dd3a5', '#d9ecd5', '#d4d8f3'],
  pink: ['#ff4c88', '#f79bbb', '#f3d4df', '#d6cff4'],
  grey: ['#86868f', '#b5b5bd', '#d9d9de', '#ececef'],
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cache = new Map<string, string>()

/** A blocky gradient image: two hot spots pulling the palette, blended with a square (Chebyshev) falloff so bands step like pixels. */
export function mosaicUrl(color: FolderColor, seed: string, cols = 16, rows = 10): string {
  const key = `${color}|${seed}|${cols}x${rows}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(hash(seed))
  const stops = PALETTES[color].map(hex)
  const hot = { x: 0.1 + r() * 0.5, y: 0.25 + r() * 0.6 }
  const cool = { x: 0.6 + r() * 0.35, y: r() * 0.5 }

  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(cols, rows)
  const aspect = cols / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = ((x + 0.5) / cols) * aspect
      const py = (y + 0.5) / rows
      const dist = (p: { x: number; y: number }) => {
        const dx = Math.abs(px - p.x * aspect)
        const dy = Math.abs(py - p.y)
        return 0.55 * Math.max(dx, dy) + 0.45 * Math.hypot(dx, dy)
      }
      const dh = dist(hot)
      const dc = dist(cool)
      let t = dh / (dh + dc + 1e-6) // 0 at the hot spot, 1 at the cool spot
      t = Math.pow(t, 1.35) // let the hot colour spread further, like a heat bloom
      t += (r() - 0.5) * 0.08
      t = Math.min(0.999, Math.max(0, t))
      const seg = t * (stops.length - 1)
      const i = Math.floor(seg)
      const f = seg - i
      const a = stops[i]
      const b = stops[i + 1]
      const o = (y * cols + x) * 4
      for (let c = 0; c < 3; c++) img.data[o + c] = Math.round(a[c] + (b[c] - a[c]) * f)
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL()
  cache.set(key, url)
  return url
}

export function Mosaic({
  color,
  seed,
  cols,
  rows,
  className = '',
  style,
  children,
}: {
  color: FolderColor
  seed: string
  cols?: number
  rows?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div className={`mosaic ${className}`} style={{ backgroundImage: `url(${mosaicUrl(color, seed, cols, rows)})`, ...style }}>
      {children}
    </div>
  )
}
