'use client'

/**
 * Barra de captura rápida, fixa acima da navegação. Sem IA nesta fase: abre a
 * Ação Rápida que já existe (novo hábito / transação / foco) através do mesmo
 * evento que o botão central da Nav dispara. É a semente do canal de conversa.
 */
export default function CaptureBar() {
  function openQuickAction() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexus:quickaction-toggle'))
    }
  }

  return (
    <button
      type="button"
      onClick={openQuickAction}
      aria-label="Captura rápida — registar algo"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(74px + env(safe-area-inset-bottom))',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        height: 50,
        padding: '0 8px 0 16px',
        borderRadius: 16,
        border: '0.5px solid var(--border)',
        background: 'rgba(var(--card-rgb),.92)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 34px rgba(0,0,0,.3)',
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      <span style={{ flex: 1, textAlign: 'left', color: 'var(--text3)', fontSize: 13.5, fontWeight: 500, fontFamily: 'var(--font-dm), "DM Sans", sans-serif' }}>
        Regista, pergunta ou pede ajuda…
      </span>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(232,168,56,.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="var(--gold)" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="var(--gold)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  )
}
