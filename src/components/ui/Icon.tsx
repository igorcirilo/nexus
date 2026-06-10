'use client'

import type { CSSProperties, ReactNode, SVGProps } from 'react'

export type IconName =
  | 'zap'
  | 'target'
  | 'clipboard'
  | 'flame'
  | 'dumbbell'
  | 'salad'
  | 'scale'
  | 'calendar'
  | 'check'
  | 'bell'
  | 'list'
  | 'trend-up'
  | 'trend-down'
  | 'plus'
  | 'chevron-left'
  | 'chevron-right'
  | 'x'
  | 'coffee'
  | 'utensils'
  | 'cup'
  | 'moon'
  | 'sunrise'
  | 'sun'
  | 'clock'
  | 'trophy'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'color'> {
  name: IconName
  size?: number
  color?: string
  style?: CSSProperties
}

export default function Icon({ name, size = 16, color = 'currentColor', style, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

const paths: Record<IconName, ReactNode> = {
  zap: <polygon points="13 2 4 14 11 14 10 22 20 10 13 10" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5A2 2 0 0 1 11 3h2a2 2 0 0 1 2 1.5" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </>
  ),
  flame: (
    <>
      <path d="M12 22c4 0 7-2.7 7-6.8 0-2.7-1.5-5.1-4.4-7.2.1 2.1-.7 3.4-2.1 4.3.2-3.4-1.2-6.3-4.2-8.3.2 3.2-1.3 5.1-2.4 6.5A7.6 7.6 0 0 0 5 15.2C5 19.3 8 22 12 22Z" />
      <path d="M12 18.5c1.7 0 3-1.1 3-2.8 0-1.2-.7-2.2-2-3.1 0 1-.4 1.6-1.1 2-.1-1.5-.8-2.6-2-3.5.1 1.6-.7 2.5-1.2 3.2-.4.5-.7 1-.7 1.6 0 1.5 1.3 2.6 4 2.6Z" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M3 9v6" />
      <path d="M6 7v10" />
      <path d="M9 10v4" />
      <path d="M15 10v4" />
      <path d="M18 7v10" />
      <path d="M21 9v6" />
      <path d="M9 12h6" />
    </>
  ),
  salad: (
    <>
      <path d="M4 12h16" />
      <path d="M6 12a6 6 0 0 0 12 0" />
      <path d="M8 10c0-2 1.4-3 3-3" />
      <path d="M12 10c0-2 1.7-4 4-4" />
      <path d="M10 7c.5-1.8 2-3 4-3" />
    </>
  ),
  scale: (
    <>
      <path d="M6 20h12" />
      <path d="M8 20V9a4 4 0 0 1 8 0v11" />
      <path d="M12 9l2-3" />
      <path d="M8 13h8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </>
  ),
  'trend-up': (
    <>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </>
  ),
  'trend-down': (
    <>
      <path d="M3 7l6 6 4-4 7 7" />
      <path d="M14 16h6v-6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  'chevron-left': <path d="M15 18l-6-6 6-6" />,
  'chevron-right': <path d="M9 18l6-6-6-6" />,
  x: (
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
      <path d="M16 9h1a3 3 0 0 1 0 6h-1" />
      <path d="M7 3v2" />
      <path d="M11 3v2" />
      <path d="M15 3v2" />
    </>
  ),
  utensils: (
    <>
      <path d="M4 3v8" />
      <path d="M7 3v8" />
      <path d="M5.5 3v18" />
      <path d="M13 3c3 2 4.5 5 4.5 9H13V3Z" />
      <path d="M17.5 12v9" />
    </>
  ),
  cup: (
    <>
      <path d="M7 4h10l-1 17H8L7 4Z" />
      <path d="M7.5 8h9" />
      <path d="M9 2h6" />
    </>
  ),
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 7 7 0 1 0 20 15.5Z" />,
  sunrise: (
    <>
      <path d="M3 18h18" />
      <path d="M5 22h14" />
      <path d="M12 2v5" />
      <path d="M4.9 9.9l3.5 3.5" />
      <path d="M19.1 9.9l-3.5 3.5" />
      <path d="M7 18a5 5 0 0 1 10 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a2 2 0 0 0 2 4h1" />
      <path d="M16 6h3a2 2 0 0 1-2 4h-1" />
      <path d="M12 12v5" />
      <path d="M9 21h6" />
      <path d="M10 17h4" />
    </>
  ),
}
