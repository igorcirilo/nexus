import { SkeletonCard } from '@/components/ui/Skeleton'

export default function CorpoLoading() {
  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <div style={{ padding: '28px 20px 0', display: 'grid', gap: 'var(--space-4)' }}>
        <SkeletonCard height={34} />
        <SkeletonCard height={156} />
        <div
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
            background: 'var(--bg2)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
          }}
        >
          <SkeletonCard height={54} />
          <SkeletonCard height={54} />
          <SkeletonCard height={54} />
        </div>
        <SkeletonCard height={220} />
      </div>
    </main>
  )
}
