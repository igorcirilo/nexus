'use client'

export default function CaptureBar() {
  return (
    <section aria-label="Captura rápida" style={{ margin: '16px 20px 0' }}>
      <a
        href="/checkin"
        aria-label="Falar com o Nexus"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 20,
          background: 'var(--bg2)',
          border: '0.5px solid var(--border)',
          textDecoration: 'none',
          touchAction: 'manipulation',
          boxShadow: '0 4px 16px rgba(0,0,0,.08)',
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            background: 'rgba(30,203,180,.1)',
            color: 'var(--teal)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MicIcon />
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 15,
            color: 'var(--text3)',
            fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
          }}
        >
          Diz algo ao Nexus…
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text3)',
            background: 'var(--bg3)',
            padding: '4px 10px',
            borderRadius: 20,
            fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          check-in
        </span>
      </a>
    </section>
  )
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}
