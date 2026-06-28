'use client'
// src/components/LegalPage.tsx — invólucro de leitura para páginas legais
// (Privacidade, Termos). Público, legível, com botão de voltar.
import Link from 'next/link'
import type { ReactNode } from 'react'

export default function LegalPage({
  title, updatedAt, children,
}: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--surface-page, #0D0F14)', fontFamily: 'Inter, sans-serif', color: 'var(--text1, #E8EAED)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px' }}>
        <Link href="/perfil" style={{ fontSize: 13, color: 'var(--text3, #8A8F99)', textDecoration: 'none' }}>‹ Voltar</Link>

        {/* Aviso: modelo a validar por advogado antes do lançamento público. */}
        <div style={{ margin: '16px 0 24px', padding: '12px 14px', borderRadius: 12, background: 'rgba(232,168,56,.08)', border: '1px solid rgba(232,168,56,.25)', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text2, #B6BAC2)' }}>
          ⚠️ <b>Modelo preliminar (beta).</b> Este texto é um ponto de partida e
          deve ser revisto por um profissional jurídico antes do lançamento
          público. Campos entre [colchetes] precisam de ser preenchidos.
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>{title}</h1>
        <p style={{ fontSize: 12.5, color: 'var(--text3, #8A8F99)', marginBottom: 24 }}>Última atualização: {updatedAt}</p>

        <div style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--text2, #B6BAC2)' }}>
          {children}
        </div>
      </div>
    </main>
  )
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text1, #E8EAED)', marginBottom: 8 }}>{n}. {title}</h2>
      {children}
    </section>
  )
}
