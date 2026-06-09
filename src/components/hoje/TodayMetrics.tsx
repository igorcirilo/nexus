'use client'

import Icon, { type IconName } from '@/components/ui/Icon'

interface TodayMetric {
  icon: IconName
  label: string
  value: string
  color: string
  progress?: number
  caption?: string
}

interface TodayMetricsProps {
  metrics: TodayMetric[]
}

export default function TodayMetrics({ metrics }: TodayMetricsProps) {
  return (
    <div style={{ padding: '12px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      {metrics.map(metric => (
        <div
          key={metric.label}
          style={{
            minHeight: 104,
            padding: '12px 8px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(28,32,48,.98), rgba(20,23,32,.98))',
            border: '0.5px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: '36px minmax(0, 1fr)',
            alignItems: 'start',
            columnGap: 8,
            rowGap: 9,
            boxShadow: '0 12px 32px rgba(0,0,0,.14)',
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 13, background: `color-mix(in srgb, ${metric.color} 20%, transparent)`, color: metric.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={metric.icon} size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {metric.label}
            </div>
            <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 24, lineHeight: 1, color: metric.color, whiteSpace: 'nowrap' }}>
              {metric.value}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {typeof metric.progress === 'number' && (
              <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, Math.min(100, metric.progress))}%`, height: '100%', borderRadius: 100, background: metric.color }} />
              </div>
            )}
            {metric.caption && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: typeof metric.progress === 'number' ? 8 : 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {metric.caption}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
