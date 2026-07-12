import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#0D0F14',
          1: '#141720',
          2: '#1C2030',
          3: '#252A3A',
        },
        gold:    { DEFAULT: '#E8A838', dim: '#7A561A', light: '#F0C060' },
        teal:    { DEFAULT: '#1ECBB4', dim: '#0A5F55' },
        accent:  { DEFAULT: '#7F77DD', dim: '#3C3489' },
        nred:    { DEFAULT: '#E24B4A' },
        text: {
          1: '#F0EDE8',
          2: '#9BA0B0',
          3: '#5A6070',
        },
        border: 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        // A fonte Syne foi REMOVIDA do app (decisão de design) — não a
        // reintroduza aqui nem em estilos inline. Display/títulos usam Inter.
        display: ['Inter', 'sans-serif'],
        dm:      ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      animation: {
        flame: 'flame 1.8s ease-in-out infinite',
        fadeUp: 'fadeUp 0.3s ease',
        pop: 'pop 0.35s ease',
      },
      keyframes: {
        flame: {
          '0%,100%': { transform: 'scale(1) rotate(-2deg)' },
          '33%':     { transform: 'scale(1.1) rotate(3deg)' },
          '66%':     { transform: 'scale(.95) rotate(-1deg)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          from: { opacity: '0', transform: 'translate(-50%,-50%) scale(.7)' },
          to:   { opacity: '1', transform: 'translate(-50%,-50%) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
