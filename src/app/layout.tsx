// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400','500','700','800'] })
const dm   = DM_Sans({ subsets: ['latin'], variable: '--font-dm',   weight: ['300','400','500'] })

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
    <html lang="pt" className={`${syne.variable} ${dm.variable}`}>
      <body className={`${syne.variable} ${dm.variable}`}>
        {/*
          Desktop: sidebar à esquerda (flex row) + conteúdo à direita
          Mobile:  só children, sidebar escondida, nav inferior via Nav.tsx
        */}
        <div className="nexus-layout">
          {/* Sidebar — só visível em desktop via CSS */}
          <div className="nexus-sidebar">
            <Sidebar />
          </div>
          {/* Área de conteúdo */}
          <div className="nexus-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
