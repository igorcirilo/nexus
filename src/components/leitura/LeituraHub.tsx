'use client'

import type { CSSProperties } from 'react'
import type { Book, BookProgress, BookHighlight } from '@/types'

const FONT = 'Inter, sans-serif'

// Gradient palettes for book covers (cycle by index)
const COVER_GRADIENTS = [
  'linear-gradient(135deg, #1a0533 0%, #3d0f7a 50%, #1a0533 100%)',
  'linear-gradient(135deg, #0d2818 0%, #1a4a2a 100%)',
  'linear-gradient(135deg, #1a0d2e 0%, #3a1a5a 100%)',
  'linear-gradient(135deg, #1a1000 0%, #3a2800 100%)',
  'linear-gradient(135deg, #001a1a 0%, #003a3a 100%)',
  'linear-gradient(135deg, #1a0010 0%, #3a0030 100%)',
]

const NOTE_COLORS = ['#F5C842', '#00D4C8', '#9D5CF5']

interface Stats {
  total: number
  inProgress: number
  completed: number
}

interface Props {
  currentBook: Book | null
  currentProgress: BookProgress | null
  highlights: BookHighlight[]
  stats: Stats
  queue: Book[]
  onOpenBook: (bookId: string) => void
  onAdd: () => void
  onLibrary: () => void
  onHighlightClick: (bookId: string, page: number) => void
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
      marginBottom: 10, marginTop: 18,
      ...style,
    }}>
      {children}
    </div>
  )
}

const iconBtn: CSSProperties = {
  width: 38, height: 38, borderRadius: 12,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
}

export default function LeituraHub({
  currentBook,
  currentProgress,
  highlights,
  stats,
  queue,
  onOpenBook,
  onAdd,
  onLibrary,
  onHighlightClick,
}: Props) {
  const pct       = currentProgress ? Math.round(currentProgress.progress_pct) : 0
  const curPage   = currentProgress?.current_page ?? 1
  const pageCount = currentBook?.raw_content?.pageCount ?? 0

  return (
    <div style={{ fontFamily: FONT, background: '#07070F', minHeight: '100vh', padding: '0 22px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 18px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Leitura</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {stats.total > 0
              ? `${stats.total} livro${stats.total !== 1 ? 's' : ''} na biblioteca`
              : 'Biblioteca vazia'}
          </div>
        </div>
        <button onClick={onAdd} style={iconBtn} aria-label="Importar ebook">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* ── Livro atual ── */}
      {currentBook ? (
        <div
          onClick={() => onOpenBook(currentBook.id)}
          style={{
            background: 'linear-gradient(135deg, #0D0E20 0%, #141428 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24, padding: 20, marginBottom: 14,
            display: 'flex', gap: 16, alignItems: 'flex-start',
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
          }}
        >
          {/* glow orb */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120,
            background: 'radial-gradient(circle, rgba(245,200,66,0.08) 0%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none' }} />

          {/* Cover */}
          <div style={{
            width: 84, height: 112, borderRadius: 10, flexShrink: 0,
            background: COVER_GRADIENTS[0],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.9)', fontWeight: 900, fontSize: 28,
            boxShadow: '4px 6px 20px rgba(0,0,0,0.5)',
            fontFamily: FONT,
          }}>
            {(currentBook.cover_label ?? currentBook.title.charAt(0)).toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', background: 'rgba(245,200,66,0.12)', color: '#F5C842',
              borderRadius: 6, padding: '3px 8px', marginBottom: 8,
            }}>
              Lendo agora
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>
              {currentBook.title}
            </div>
            {currentBook.author && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>
                {currentBook.author}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                {pageCount > 0 ? `Pág. ${curPage} / ${pageCount}` : `Pág. ${curPage}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F5C842' }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`,
                background: 'linear-gradient(90deg, #F5C842, #E07B2A)', borderRadius: 6 }} />
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={onAdd}
          style={{
            background: 'rgba(245,200,66,0.04)', border: '1px dashed rgba(245,200,66,0.2)',
            borderRadius: 24, padding: '28px 20px', marginBottom: 14,
            textAlign: 'center', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Nenhum livro em leitura</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5C842' }}>Importar ebook PDF</div>
        </div>
      )}

      {/* ── Estatísticas da biblioteca ── */}
      <SectionLabel>Biblioteca</SectionLabel>
      <div
        onClick={onLibrary}
        style={{ display: 'flex', gap: 10, cursor: 'pointer' }}
      >
        {[
          { label: 'Total',       value: stats.total,      color: '#fff'     },
          { label: 'Em leitura',  value: stats.inProgress, color: '#F5C842'  },
          { label: 'Concluídos',  value: stats.completed,  color: '#00C896'  },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '14px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Destaques / Insights ── */}
      {highlights.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 18 }}>Destaques do livro atual</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {highlights.slice(0, 3).map((h, i) => (
              <div
                key={h.id}
                onClick={() => currentBook && onHighlightClick(currentBook.id, h.page)}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: '14px 16px', position: 'relative', cursor: 'pointer',
                }}
              >
                <div style={{
                  position: 'absolute', left: 0, top: 16, bottom: 16, width: 3,
                  borderRadius: '0 3px 3px 0', background: NOTE_COLORS[i % NOTE_COLORS.length],
                }} />
                <div style={{
                  fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                  lineHeight: 1.6, fontStyle: 'italic', marginBottom: 8, paddingLeft: 10,
                }}>
                  "{h.excerpt}"
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 10,
                }}>
                  Pág. {h.page} · {currentBook?.title ?? ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Próximos na fila ── */}
      {queue.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 18 }}>Próximos na fila</SectionLabel>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {queue.slice(0, 6).map((book, i) => (
              <div
                key={book.id}
                onClick={() => onOpenBook(book.id)}
                style={{ flexShrink: 0, width: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <div style={{
                  width: 68, height: 90, borderRadius: 8,
                  background: COVER_GRADIENTS[(i + 1) % COVER_GRADIENTS.length],
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.8)', fontWeight: 900, fontSize: 22,
                  fontFamily: FONT,
                }}>
                  {(book.cover_label ?? book.title.charAt(0)).toUpperCase()}
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
                  textAlign: 'center', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {book.title}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── CTA ver biblioteca ── */}
      <button
        onClick={onLibrary}
        style={{
          marginTop: 24, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '13px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)',
          fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        Ver biblioteca completa
      </button>
    </div>
  )
}
