import { SkeletonCard } from '@/components/ui/Skeleton'

// Espelha o layout do Resumo (aba padrão, full-bleed): header, hero grande,
// card de treino, linha de 3 macros e card de hidratação. Assim o conteúdo
// real substitui o skeleton sem "saltar" de layout.
export default function CorpoLoading() {
  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh', background: 'var(--surface-page)' }}>
      <div style={{ padding: '20px 22px 28px', display: 'grid', gap: 14 }}>
        {/* Header: título + subtítulo */}
        <div style={{ display: 'grid', gap: 6, marginBottom: 4 }}>
          <SkeletonCard height={30} />
          <SkeletonCard height={14} />
        </div>

        {/* Hero de peso */}
        <SkeletonCard height={190} />

        {/* Card de treino de hoje */}
        <SkeletonCard height={150} />

        {/* Macros de nutrição */}
        <div
          aria-hidden="true"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
        >
          <SkeletonCard height={92} />
          <SkeletonCard height={92} />
          <SkeletonCard height={92} />
        </div>

        {/* Hidratação */}
        <SkeletonCard height={120} />
      </div>
    </main>
  )
}
