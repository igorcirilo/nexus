'use client'

interface SkeletonCardProps {
  height: number
}

interface SkeletonRowProps {
  count: number
}

const skeletonBase = {
  background: 'linear-gradient(90deg, var(--bg2), var(--bg3), var(--bg2))',
  backgroundSize: '200% 100%',
  animation: 'skeletonShimmer 1.2s ease-in-out infinite',
  border: '0.5px solid var(--border)',
}

export function SkeletonCard({ height }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...skeletonBase,
        height,
        width: '100%',
        borderRadius: 'var(--radius-md)',
      }}
    />
  )
}

export function SkeletonRow({ count }: SkeletonRowProps) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            ...skeletonBase,
            height: 48,
            width: '100%',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      ))}
    </div>
  )
}
