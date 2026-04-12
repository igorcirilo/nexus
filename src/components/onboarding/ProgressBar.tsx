type Props = { current: number; total: number }

export function ProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)

  return (
    <div style={{ width: '100%', padding: '0 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Pergunta {current} de {total}</span>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
      <div style={{ background: 'var(--bg3)', height: 3, borderRadius: 100, marginTop: 8, overflow: 'hidden' }}>
        <div
          style={{
            background: 'var(--accent)',
            height: '100%',
            borderRadius: 100,
            width: `${pct}%`,
            transition: 'width .4s ease',
          }}
        />
      </div>
    </div>
  )
}
