// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import Sidebar from '@/components/Sidebar'
import dynamic from 'next/dynamic'
import './globals.css'

// QuickAction + Pomodoro — cliente only, não aparece em /auth e /onboarding
const GlobalUI    = dynamic(() => import('@/components/GlobalUI'), { ssr: false })
const ToastClient = dynamic(() => import('@/components/Toast').then(m => ({ default: m.ToastProvider })), { ssr: false })

export const metadata: Metadata = {
  title: 'NEXUS — Evolução Pessoal',
  description: 'O teu sistema diário de alta performance',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'NEXUS' },
  icons: { apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  themeColor: '#0D0F14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        {/* Aplica o tema guardado antes da pintura para evitar flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nexus-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ToastClient>
          <div className="nexus-layout">
            <div className="nexus-sidebar">
              <Sidebar />
            </div>
            <div className="nexus-content">
              {children}
              <GlobalUI />
            </div>
          </div>
        </ToastClient>
      </body>
    </html>
  )
}
