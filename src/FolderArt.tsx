import type { FolderColor } from './store'

export const COLORS: FolderColor[] = ['blue', 'yellow', 'lavender', 'green', 'pink', 'orange', 'grey']

interface Props {
  color: FolderColor
  count: number
  label?: string
  size?: 'lg' | 'sm'
}

/** The glassy folder illustration: back panel + peeking pages + frosted front panel. */
export function FolderArt({ color, count, label, size = 'lg' }: Props) {
  return (
    <div className={`folder-art folder-${color} folder-${size}`} aria-hidden>
      <div className="fa-glow" />
      <div className="fa-back" />
      <div className="fa-page fa-page-1">
        <i /><i /><i />
      </div>
      <div className="fa-page fa-page-2">
        <i /><i /><i />
      </div>
      <div className="fa-front">
        {size === 'lg' && (
          <>
            <span className="fa-chip fa-count">{count}</span>
            {label && <span className="fa-chip fa-label">{label}</span>}
            <span className="fa-rule" />
          </>
        )}
      </div>
    </div>
  )
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <g fill="currentColor">
        <path id="dok-arm" d="M41 7Q41 3 45 3H55Q59 3 59 7L55 50L59 93Q59 97 55 97H45Q41 97 41 93L45 50Z" />
        <use href="#dok-arm" transform="rotate(60 50 50)" />
        <use href="#dok-arm" transform="rotate(120 50 50)" />
      </g>
    </svg>
  )
}
