'use client'

interface ErrorStateProps {
  /** Título curto e humano. */
  title?: string
  /** Explicação acionável (sem jargão técnico). */
  body?: string
  /** Callback de nova tentativa (normalmente o `reset` do error.tsx). */
  onRetry?: () => void
  retryLabel?: string
}

/**
 * Estado de erro reutilizável para error boundaries de rota.
 * Mantém o tom calmo: a falha é tratável e o utilizador tem um próximo passo.
 */
export default function ErrorState({
  title = 'Algo não carregou',
  body = 'Não conseguimos carregar esta página agora. Verifica a tua ligação e tenta de novo.',
  onRetry,
  retryLabel = 'Tentar de novo',
}: ErrorStateProps) {
  return (
    <main
      role="alert"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 14,
        padding: '40px 28px calc(120px + env(safe-area-inset-bottom))',
        animation: 'fadeUp .3s ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(226,75,74,.12)',
          color: 'var(--nred, #E24B4A)',
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 28,
          lineHeight: 1,
        }}
      >
        !
      </span>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text1)' }}>
        {title}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 320, lineHeight: 1.5 }}>{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            minHeight: 48,
            marginTop: 6,
            padding: '0 24px',
            border: 'none',
            borderRadius: 14,
            background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
            color: 'var(--bg0)',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 15,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {retryLabel}
        </button>
      )}
    </main>
  )
}
