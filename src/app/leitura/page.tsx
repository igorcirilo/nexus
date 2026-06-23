'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import LeituraHub from '@/components/leitura/LeituraHub'
import FileImportModal from '@/components/FileImportModal'
import { supabase, getBooks, getBookProgress, getBookHighlights, saveBook, getReadingSessionsThisWeek } from '@/lib/supabase'
import { darkCardInk } from '@/lib/theme'
import { localDateKey } from '@/lib/date'
import type { Book, BookProgress, BookHighlight, FileImportResult } from '@/types'

interface WeeklyStats {
  days: Array<{ date: string; minutes: number }>
  totalMinutes: number
  daysWithReading: number
  avgMinPerDay: number
  pagesPerDay: number
}

function inferTitle(fileName: string) {
  return fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim()
}

function buildToc(pages: Array<{ pageNumber: number; text: string }>) {
  const toc = pages
    .map((page) => {
      const lines = page.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      const heading = lines.find(
        (line) =>
          /^(cap[íi]tulo|chapter|parte|sec[çc][ãa]o)\b/i.test(line) ||
          (line.length > 8 && line.length < 80 && line === line.toUpperCase())
      )

      return heading
        ? { label: heading.slice(0, 60), page: page.pageNumber }
        : null
    })
    .filter(Boolean) as Array<{ label: string; page: number }>

  if (toc.length > 0) return toc.slice(0, 24)

  return pages
    .filter((page) => page.pageNumber === 1 || (page.pageNumber - 1) % 10 === 0)
    .map((page) => ({ label: `Página ${page.pageNumber}`, page: page.pageNumber }))
}

const COVER_GRADS = [
  'linear-gradient(135deg, #1a0533 0%, #3d0f7a 50%, #1a0533 100%)',
  'linear-gradient(135deg, #0d2818 0%, #1a4a2a 100%)',
  'linear-gradient(135deg, #1a0d2e 0%, #3a1a5a 100%)',
  'linear-gradient(135deg, #1a1000 0%, #3a2800 100%)',
  'linear-gradient(135deg, #001a1a 0%, #003a3a 100%)',
  'linear-gradient(135deg, #1a0010 0%, #3a0030 100%)',
]

export default function LeituraPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showBiblioteca, setShowBiblioteca] = useState(false)
  const [toast, setToast] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, BookProgress | null>>({})
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>(() => {
    const now         = new Date()
    const dayOfWeek   = now.getDay()
    const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday      = new Date(now)
    monday.setDate(now.getDate() - daysFromMon)
    return {
      days: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return { date: localDateKey(d), minutes: 0 }
      }),
      totalMinutes: 0, daysWithReading: 0, avgMinPerDay: 0, pagesPerDay: 0,
    }
  })

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 2400)
  }

  async function loadData(uid: string) {
    const nextBooks = (await getBooks(uid)) as Book[]
    setBooks(nextBooks)

    const pairs = await Promise.all(
      nextBooks.map(async (book) => [book.id, await getBookProgress(book.id, uid)] as const)
    )
    const pm = Object.fromEntries(pairs)
    setProgressMap(pm)

    // Fetch highlights for the "current" book (highest in-progress).
    const current = nextBooks
      .filter(b => { const p = pm[b.id]; return p && p.progress_pct > 0 && p.progress_pct < 100 })
      .sort((a, b) => (pm[b.id]?.progress_pct ?? 0) - (pm[a.id]?.progress_pct ?? 0))[0]
      ?? nextBooks.find(b => (pm[b.id]?.progress_pct ?? 0) === 0)

    if (current) {
      const hl = await getBookHighlights(current.id, uid) as BookHighlight[]
      setHighlights(hl ?? [])
    } else {
      setHighlights([])
    }

    const sessions = await getReadingSessionsThisWeek(uid)

    const now2        = new Date()
    const dow2        = now2.getDay()
    const dfm2        = dow2 === 0 ? 6 : dow2 - 1
    const monday2     = new Date(now2)
    monday2.setDate(now2.getDate() - dfm2)

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday2)
      d.setDate(monday2.getDate() + i)
      return localDateKey(d)
    })

    const minByDate:   Record<string, number> = {}
    const pagesByDate: Record<string, number> = {}
    sessions.forEach(s => {
      minByDate[s.date]   = (minByDate[s.date]   ?? 0) + s.duration_minutes
      pagesByDate[s.date] = (pagesByDate[s.date] ?? 0) + s.pages_read
    })

    const wDays           = weekDays.map(date => ({ date, minutes: minByDate[date] ?? 0 }))
    const totalMinutes    = wDays.reduce((sum, d) => sum + d.minutes, 0)
    const daysWithReading = wDays.filter(d => d.minutes > 0).length
    const avgMinPerDay    = daysWithReading > 0 ? Math.round(totalMinutes / daysWithReading) : 0
    const totalPages      = Object.values(pagesByDate).reduce((sum, p) => sum + p, 0)
    const daysWPages      = Object.values(pagesByDate).filter(p => p > 0).length
    const pagesPerDay     = daysWPages > 0 ? Math.round(totalPages / daysWPages) : 0

    setWeeklyStats({ days: wDays, totalMinutes, daysWithReading, avgMinPerDay, pagesPerDay })
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      if (!active) return
      setUserId(user.id)
      await loadData(user.id)
      if (!active) return
      setLoading(false)
    }

    bootstrap()
    return () => { active = false }
  }, [])

  async function handleImport(result: FileImportResult) {
    if (!userId || result.kind !== 'pdf') return

    const title = inferTitle(result.meta.fileName)
    const toc = buildToc(result.pages)

    const { error } = await saveBook({
      user_id: userId,
      title,
      author: null,
      source_file_name: result.meta.fileName,
      cover_label: title.slice(0, 1).toUpperCase(),
      raw_content: {
        pageCount: result.pageCount,
        extractedText: result.extractedText,
        pages: result.pages,
        toc,
      },
    })

    if (error) { showToast('Erro ao importar ebook.'); return }

    await loadData(userId)
    setShowImport(false)
    showToast('Ebook importado com sucesso.')
  }

  const stats = useMemo(() => {
    const total = books.length
    const inProgress = books.filter(b => { const p = progressMap[b.id]?.progress_pct ?? 0; return p > 0 && p < 100 }).length
    const completed = books.filter(b => (progressMap[b.id]?.progress_pct ?? 0) >= 100).length
    return { total, inProgress, completed }
  }, [books, progressMap])

  const currentBook = useMemo(() => {
    return books
      .filter(b => { const p = progressMap[b.id]; return p && p.progress_pct > 0 && p.progress_pct < 100 })
      .sort((a, b) => (progressMap[b.id]?.progress_pct ?? 0) - (progressMap[a.id]?.progress_pct ?? 0))[0]
      ?? null
  }, [books, progressMap])

  const queue = useMemo(() =>
    books.filter(b => (progressMap[b.id]?.progress_pct ?? 0) === 0),
    [books, progressMap]
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>
        a carregar…
      </div>
    )
  }

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh', background: 'var(--surface-page)' }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: 'var(--surface-card)', border: '1px solid rgba(0,200,150,0.25)',
          borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#00C896',
          fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
        }}>
          ✓ {toast}
        </div>
      )}

      <LeituraHub
        currentBook={currentBook}
        currentProgress={currentBook ? (progressMap[currentBook.id] ?? null) : null}
        highlights={highlights}
        stats={stats}
        queue={queue}
        weeklyStats={weeklyStats}
        onOpenBook={(id) => router.push(`/leitura/${id}`)}
        onAdd={() => setShowImport(true)}
        onLibrary={() => setShowBiblioteca(true)}
        onHighlightClick={(bookId, page) => router.push(`/leitura/${bookId}?page=${page}`)}
      />
      <Nav />

      {showBiblioteca && (
        <div
          style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowBiblioteca(false)}
        >
          <div style={{
            width:'100%', maxWidth:480, margin:'0 auto',
            background:'var(--surface-page)', borderRadius:'20px 20px 0 0',
            borderTop:'1px solid rgba(var(--ink-rgb),0.08)',
            display:'flex', flexDirection:'column', maxHeight:'85vh',
            fontFamily:'Inter, sans-serif',
          }}>
            <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid rgba(var(--ink-rgb),0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color: 'var(--ink)' }}>Biblioteca</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                  {books.length} livro{books.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button
                  onClick={() => { setShowBiblioteca(false); setShowImport(true) }}
                  style={{
                    padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg, #F5C842, #E07B2A)', color:'var(--surface-page)',
                    fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:12,
                  }}
                >
                  + Importar
                </button>
                <button
                  onClick={() => setShowBiblioteca(false)}
                  style={{ width:32, height:32, borderRadius:9, background:'var(--surface-3)', border:'none', cursor:'pointer', fontSize:18, color:'var(--text1)' }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ overflowY:'auto', flex:1, padding:'12px 20px 24px', display:'flex', flexDirection:'column', gap:10 }}>
              {books.length === 0 ? (
                <div style={{ padding:'32px 0', textAlign:'center' }}>
                  <div style={{ fontSize:13, color:'var(--text3)', marginBottom:10 }}>Ainda não tens ebooks na biblioteca.</div>
                  <button
                    onClick={() => { setShowBiblioteca(false); setShowImport(true) }}
                    style={{ background:'none', border:'1px solid rgba(245,200,66,0.3)', borderRadius:10, padding:'9px 16px', color:'#F5C842', fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:13, cursor:'pointer' }}
                  >
                    Importar primeiro ebook
                  </button>
                </div>
              ) : (
                books.map((book, idx) => {
                  const progress = progressMap[book.id]
                  const pct = Math.round(progress?.progress_pct ?? 0)
                  const curPage = progress?.current_page ?? 1
                  const grad = COVER_GRADS[idx % COVER_GRADS.length]
                  const isActive = pct > 0 && pct < 100

                  return (
                    <div
                      key={book.id}
                      onClick={() => { setShowBiblioteca(false); router.push(`/leitura/${book.id}`) }}
                      style={{
                        display:'flex', gap:14, alignItems:'flex-start',
                        background:'var(--surface-2)', border:`1px solid ${isActive ? 'rgba(245,200,66,0.15)' : 'rgba(var(--ink-rgb),0.07)'}`,
                        borderRadius:16, padding:14, cursor:'pointer',
                      }}
                    >
                      <div style={{
                        ...darkCardInk,
                        width:52, height:70, borderRadius:8, flexShrink:0,
                        background:grad, display:'flex', alignItems:'center', justifyContent:'center',
                        color:'var(--text1)', fontWeight:900, fontSize:20,
                        boxShadow:'0 4px 14px rgba(0,0,0,0.4)',
                      }}>
                        {(book.cover_label ?? book.title.charAt(0)).toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, color: 'var(--ink)', marginBottom:3, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {book.title}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>
                          {book.source_file_name ?? 'PDF importado'}
                        </div>
                        <div style={{ height:5, background:'var(--surface-3)', borderRadius:5, overflow:'hidden', marginBottom:5 }}>
                          <div style={{
                            height:'100%', borderRadius:5, width:`${pct}%`,
                            background: pct >= 100 ? '#00C896' : 'linear-gradient(90deg, #F5C842, #E07B2A)',
                          }} />
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)' }}>
                          <span>{pct >= 100 ? '✓ Concluído' : `${pct}% lido`}</span>
                          <span>Página {curPage}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <FileImportModal
        open={showImport}
        title="Importar ebook"
        kind="pdf"
        onClose={() => setShowImport(false)}
        onConfirm={handleImport}
        confirmLabel="Guardar ebook"
      />
    </main>
  )
}
