import type { FolderColor } from './store'

export const COLORS: FolderColor[] = ['blue', 'yellow', 'lavender', 'green', 'pink', 'orange', 'grey']

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
