'use client'

import type { CSSProperties, ReactNode, SVGProps } from 'react'

import type { IconName } from '@/lib/icons'
export type { IconName }

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

/**
 * Ícone + texto na mesma linha (botões, chips, toasts, rótulos).
 * `after` põe o ícone depois do texto (ex.: "Próxima →").
 */
export function IconLabel({
  icon,
  children,
  size = 14,
  gap = 6,
  after = false,
  color,
  style,
}: {
  icon: IconName
  children?: ReactNode
  size?: number
  gap?: number
  after?: boolean
  color?: string
  style?: CSSProperties
}) {
  const ic = <Icon name={icon} size={size} color={color} />
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, verticalAlign: 'middle', ...style }}>
      {!after && ic}
      {children}
      {after && ic}
    </span>
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
  'chevron-down': <path d="M6 9l6 6 6-6" />,
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

  // ── navegação e ações ──
  'arrow-right': <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  'arrow-left': <><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>,
  'arrow-up': <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  'arrow-down': <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  repeat: (
    <>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </>
  ),
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  pencil: <><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /><path d="M14.5 5.5l3 3" /></>,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  pin: <><path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3Z" /></>,
  upload: <><path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  'file-text': (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </>
  ),
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9" />
      <path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5Z" /></>,

  // ── estado ──
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  'alert-triangle': <><path d="M10.3 4l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  'alert-circle': <><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></>,
  lightbulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
    </>
  ),
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,

  // ── finanças ──
  wallet: (
    <>
      <path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
      <path d="M16 14h.01" />
    </>
  ),
  'piggy-bank': (
    <>
      <path d="M19 9.5c1.2.3 2 1 2 1.5v2h-1.5a7 7 0 0 1-2.5 3V19h-3v-1.5h-4V19H7v-2.6A6.5 6.5 0 0 1 4 11c0-3.6 3.1-6 7-6 1.6 0 3 .4 4.2 1L18 5v4.5Z" />
      <path d="M15 10h.01" />
    </>
  ),
  landmark: <><path d="M3 21h18" /><path d="M5 18v-7" /><path d="M10 18v-7" /><path d="M14 18v-7" /><path d="M19 18v-7" /><path d="M12 3l9 5H3Z" /></>,
  banknote: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01" /><path d="M18 12h.01" /></>,
  'credit-card': <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></>,
  receipt: (
    <>
      <path d="M5 3v18l2.3-1.5L9.7 21 12 19.5 14.3 21l2.4-1.5L19 21V3l-2.3 1.5L14.3 3 12 4.5 9.7 3 7.3 4.5Z" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
    </>
  ),
  'bar-chart': <><path d="M4 20h16" /><path d="M7 16v-5" /><path d="M12 16V6" /><path d="M17 16v-8" /></>,
  hourglass: <><path d="M6 3h12" /><path d="M6 21h12" /><path d="M7 3c0 5 10 5 10 9s-10 4-10 9" /><path d="M17 3c0 5-10 5-10 9s10 4 10 9" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6Z" />,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><path d="M8 8h.01" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" /><path d="M12 8v13" /><path d="M12 8S10.5 3 8 4s0 4 4 4c4 0 6.5-3 4-4s-4 4-4 4" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M3 13h18" /></>,
  package: <><path d="M21 8l-9-5-9 5v8l9 5 9-5Z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /></>,
  cart: <><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6" /></>,
  car: <><path d="M5 17H3v-5l2-5h14l2 5v5h-2" /><path d="M3 12h18" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /><path d="M9.5 17h5" /></>,
  bus: <><rect x="4" y="3" width="16" height="15" rx="2" /><path d="M4 11h16" /><path d="M7 18v3" /><path d="M17 18v3" /><path d="M8 15h.01" /><path d="M16 15h.01" /></>,
  plane: <path d="M17.8 19.2L16 11l3.5-3.5A2.1 2.1 0 0 0 16.5 4.5L13 8 4.8 6.2 3 8l6.5 3.5L7 14H4l-1 1 3 2 2 3 1-1v-3l2.5-2.5L15 20Z" />,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h.01" /><path d="M15 7h.01" /><path d="M9 11h.01" /><path d="M15 11h.01" /><path d="M9 15h.01" /><path d="M15 15h.01" /><path d="M10 21v-3h4v3" /></>,
  droplet: <path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12Z" />,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
  laptop: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 20h20" /></>,
  pill: <><path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7Z" /><path d="M8.5 8.5l7 7" /></>,
  heart: <path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20Z" />,
  'heart-pulse': <><path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20Z" /><path d="M4.5 12H9l1.5-2.5 2.5 5 1.5-2.5h5" /></>,
  gamepad: <><rect x="2" y="7" width="20" height="11" rx="4" /><path d="M7 11v3" /><path d="M5.5 12.5h3" /><path d="M15 12h.01" /><path d="M18 13.5h.01" /></>,
  film: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18" /><path d="M17 3v18" /><path d="M3 8h4" /><path d="M3 16h4" /><path d="M17 8h4" /><path d="M17 16h4" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  book: <><path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5a2.5 2.5 0 0 0 0 5H20" /><path d="M8 7h8" /></>,
  'book-open': <><path d="M2 5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z" /><path d="M22 5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z" /></>,
  'graduation-cap': <><path d="M22 9L12 4 2 9l10 5Z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /><path d="M22 9v6" /></>,
  shirt: <path d="M8 3L3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0Z" />,
  scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9" /><path d="M14.5 14.5L20 20" /><path d="M8.1 8.1L12 12" /></>,
  paw: <><circle cx="5.5" cy="10" r="1.8" /><circle cx="9.5" cy="5.5" r="1.8" /><circle cx="14.5" cy="5.5" r="1.8" /><circle cx="18.5" cy="10" r="1.8" /><path d="M12 11c-3 0-6 4.5-6 7a2.5 2.5 0 0 0 3.5 2.3 6 6 0 0 1 5 0A2.5 2.5 0 0 0 18 18c0-2.5-3-7-6-7Z" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-1 1a6 6 0 0 1-7.4.8L6 21.4a2 2 0 0 1-3-3l6.6-6.6A6 6 0 0 1 10 4.4l1-1 1.7 1.3a4 4 0 0 0 2 1.6Z" />,
  sprout: <><path d="M12 21v-9" /><path d="M12 12C12 8 9 6 4 6c0 4 3 6 8 6Z" /><path d="M12 14c0-4 3-6 8-6 0 4-3 6-8 6Z" /></>,
  tv: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M8 2l4 4 4-4" /></>,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" /><path d="M12 19v3" /><path d="M4.9 4.9L7 7" /><path d="M17 17l2.1 2.1" />
      <path d="M2 12h3" /><path d="M19 12h3" /><path d="M4.9 19.1L7 17" /><path d="M17 7l2.1-2.1" />
    </>
  ),
  fuel: <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M3 21h12" /><path d="M4 10h10" /><path d="M14 8l4 3v6a1.5 1.5 0 0 0 3 0V9l-3-3" /></>,

  // ── pessoas e áreas ──
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  message: <path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-5A8 8 0 1 1 21 12Z" />,
  leaf: <><path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15Z" /><path d="M5 19l8-8" /></>,
  brain: (
    <>
      <path d="M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 8a3 3 0 0 0 0 5 3.5 3.5 0 0 0 3 5.5A2.5 2.5 0 0 0 12 19Z" />
      <path d="M12 5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 8a3 3 0 0 1 0 5 3.5 3.5 0 0 1-3 5.5A2.5 2.5 0 0 1 12 19Z" />
      <path d="M12 5v14" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  bed: <><path d="M3 18V6" /><path d="M3 14h18v4" /><path d="M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="2" /></>,
  snowflake: <><path d="M12 2v20" /><path d="M3.3 7l17.4 10" /><path d="M20.7 7L3.3 17" /><path d="M9 4l3 2 3-2" /><path d="M9 20l3-2 3 2" /></>,
  gem: <><path d="M6 3h12l4 6-10 12L2 9Z" /><path d="M2 9h20" /><path d="M12 21L8 9l4-6 4 6Z" /></>,
  mountain: <><path d="M3 20l6.5-12 4 7 2.5-4L21 20Z" /><path d="M8 11l1.5 1.5L11 11" /></>,
  medal: <><circle cx="12" cy="15" r="6" /><path d="M8.5 3L12 9l3.5-6" /><path d="M12 12.5v5" /></>,
  phone: <path d="M5 3h3.5l2 5-2.5 1.5a11 11 0 0 0 6.5 6.5L16 13.5l5 2V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  tree: <><path d="M12 21v-5" /><path d="M12 3l6 8h-3l4 5H5l4-5H6Z" /></>,
  wind: <><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 12h16a3 3 0 1 1-3 3" /><path d="M3 16h7" /></>,
  notebook: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18" /><path d="M12 8h4" /><path d="M12 12h4" /></>,

  // ── humor (check-in): do mais baixo ao mais alto ──
  'mood-1': <><circle cx="12" cy="12" r="9" /><path d="M8.5 16.5a4.5 4.5 0 0 1 7 0" /><path d="M9 10h.01" /><path d="M15 10h.01" /></>,
  'mood-2': <><circle cx="12" cy="12" r="9" /><path d="M8.5 15.5h7" /><path d="M9 10h.01" /><path d="M15 10h.01" /></>,
  'mood-3': <><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4.5 4.5 0 0 0 7 0" /><path d="M9 10h.01" /><path d="M15 10h.01" /></>,
  'mood-4': <><circle cx="12" cy="12" r="9" /><path d="M7.5 13h9a4.5 4.5 0 0 1-9 0Z" /><path d="M9 9.5h.01" /><path d="M15 9.5h.01" /></>,
}
