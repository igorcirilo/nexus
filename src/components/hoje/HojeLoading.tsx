'use client'

import { SkeletonCard } from '@/components/ui/Skeleton'

export default function HojeLoading() {
  return (
    <main style={{ minHeight: '100vh', padding: '28px 20px 100px', display: 'grid', gap: 'var(--space-3)' }}>
      <SkeletonCard height={60} />
      <SkeletonCard height={40} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <SkeletonCard height={68} />
        <SkeletonCard height={68} />
        <SkeletonCard height={68} />
      </div>
      <SkeletonCard height={112} />
      <SkeletonCard height={84} />
      <SkeletonCard height={120} />
      <SkeletonCard height={120} />
    </main>
  )
}
