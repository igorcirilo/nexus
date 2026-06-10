'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Nav from '@/components/Nav'
import {
  supabase,
  deleteBookBookmark,
  deleteBookHighlight,
  deleteBookNote,
  getBookBookmarks,
  getBookById,
  getBookHighlights,
  getBookNotes,
  getBookProgress,
  getReadingPreference,
  saveBookBookmark,
  saveBookHighlight,
  saveBookNote,
  saveBookProgress,
  saveReadingPreference,
  saveReadingSession,
} from '@/lib/supabase'
import type {
  Book,
  BookBookmark,
  BookHighlight,
  BookNote,
  ReaderMode,
  ReaderTheme,
  ReadingPreference,
} from '@/types'

// ── Theme palette ────────────────────────────────────────────────────────────

const themeMap: Record<ReaderTheme, { bg: string; text: string; panel: string; border: string; accent: string }> = {
  claro:   { bg: '#F7F3EA', text: '#1E1C18', panel: '#FFFFFF',  border: 'rgba(30,28,24,0.1)',     accent: '#E8A838' },
  sepia:   { bg: '#F3E8D2', text: '#3C2F22', panel: '#F7ECD9',  border: 'rgba(60,47,34,0.12)',    accent: '#E8A838' },
  noturno: { bg: '#10131A', text: '#E8E3D7', panel: '#171B24',  border: 'rgba(255,255,255,0.07)', accent: '#F5C842' },
}

const SWIPE_THRESHOLD = 48
const WORDS_PER_MIN   = 250

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function estimateMins(pages: Array<{ text?: string }>, fromPage: number): number {
  const words = pages
    .slice(fromPage - 1)
    .reduce((s, p) => s + (p.text?.split(/\s+/).length ?? 0), 0)
  return Math.max(1, Math.round(words / WORDS_PER_MIN))
}

type AnnTab = 'destaques' | 'notas' | 'marcadores'

// ── Component ────────────────────────────────────────────────────────────────

export default function LeituraReaderPage() {
  const params = useParams<{ id: string }>()
  const bookId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [userId, setUserId]       = useState<string | null>(null)
  const [book, setBook]           = useState<Book | null>(null)
  const [loading, setLoading]     = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [resumePrompt, setResumePrompt] = useState<number | null>(null)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tocOpen, setTocOpen]           = useState(false)
  const [annOpen, setAnnOpen]           = useState(false)
  const [annTab, setAnnTab]             = useState<AnnTab>('destaques')
  const [headerVisible, setHeaderVisible] = useState(true)

  const [highlightText, setHighlightText] = useState('')
  const [noteText, setNoteText]           = useState('')
  const [highlights, setHighlights]       = useState<BookHighlight[]>([])
  const [notes, setNotes]                 = useState<BookNote[]>([])
  const [bookmarks, setBookmarks]         = useState<BookBookmark[]>([])
  const [prefs, setPrefs]                 = useState<ReadingPreference | null>(null)
  const [toast, setToast]                 = useState('')

  const sessionStartRef  = useRef<{ time: number; page: number } | null>(null)
  const currentPageRef   = useRef(1)
  const touchStartX      = useRef<number | null>(null)
  const headerTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadAll(uid: string, id: string) {
    const [nextBook, progress, nextHL, nextNotes, nextBM, nextPrefs] = await Promise.all([
      getBookById(id, uid),
      getBookProgress(id, uid),
      getBookHighlights(id, uid),
      getBookNotes(id, uid),
      getBookBookmarks(id, uid),
      getReadingPreference(uid),
    ])

    setBook(nextBook as Book | null)
    setHighlights((nextHL ?? []) as BookHighlight[])
    setNotes((nextNotes ?? []) as BookNote[])
    setBookmarks((nextBM ?? []) as BookBookmark[])
    setPrefs((nextPrefs as ReadingPreference | null) ?? {
      id: 'local', user_id: uid, theme: 'sepia', reading_mode: 'paginado',
      font_scale: 1, line_height: 1.8, margin_px: 24,
      updated_at: new Date().toISOString(),
    })

    const pageParam     = new URLSearchParams(window.location.search).get('page')
    const requestedPage = pageParam ? parseInt(pageParam, 10) : NaN
    const savedPage     = progress?.current_page ?? 1
    const maxPage       = nextBook?.raw_content?.pageCount ?? 1

    if (!isNaN(requestedPage) && requestedPage > 0) {
      setCurrentPage(clamp(requestedPage, 1, maxPage))
    } else if (savedPage > 1) {
      setCurrentPage(1)
      setResumePrompt(clamp(savedPage, 1, maxPage))
    }
    // else default page 1 already set
  }

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      if (!bookId || !active) return
      setUserId(user.id)
      await loadAll(user.id, bookId)
      if (!active) return
      setLoading(false)
    }
    bootstrap()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  // ── Header auto-hide on scroll ────────────────────────────────────────────

  useEffect(() => {
    function onScroll() {
      setHeaderVisible(false)
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current)
      headerTimerRef.current = setTimeout(() => setHeaderVisible(true), 1600)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Derived values ────────────────────────────────────────────────────────

  const pages     = book?.raw_content?.pages ?? []
  const pageCount = book?.raw_content?.pageCount ?? 1
  const toc       = book?.raw_content?.toc ?? []
  const currentPageData = pages.find(p => p.pageNumber === currentPage) ?? pages[0]

  const currentChapter = useMemo(() => {
    if (!toc.length) return null
    const sorted = [...toc].sort((a, b) => a.page - b.page)
    let ch = sorted[0]
    for (const entry of sorted) {
      if (entry.page <= currentPage) ch = entry
      else break
    }
    return ch
  }, [toc, currentPage])

  const currentHighlights = highlights.filter(h => h.page === currentPage)
  const currentNotes      = notes.filter(n => n.page === currentPage)
  const currentBookmark   = bookmarks.find(b => b.page === currentPage)

  const currentTheme  = prefs?.theme ?? 'sepia'
  const palette       = themeMap[currentTheme]
  const isDark        = currentTheme === 'noturno'
  const progressPct   = Math.round((currentPage / Math.max(pageCount, 1)) * 100)
  const minsLeft      = pages.length > 0 ? estimateMins(pages, currentPage) : null
  const readingMode   = prefs?.reading_mode ?? 'paginado'

  const overlay      = isDark ? '255,255,255' : '0,0,0'
  const headerBg     = isDark
    ? 'rgba(16,19,26,0.92)'
    : currentTheme === 'sepia' ? 'rgba(243,232,210,0.92)' : 'rgba(247,243,234,0.92)'
  const sheetBg      = isDark ? '#171B24' : palette.panel

  // ── Persist progress ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId || !bookId || !book) return
    const pct = Math.round((currentPage / Math.max(pageCount, 1)) * 100)
    saveBookProgress({ user_id: userId, book_id: bookId, current_page: currentPage, progress_pct: pct })
  }, [userId, bookId, book, currentPage, pageCount])

  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])

  // ── Session tracking ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId || !bookId) return
    sessionStartRef.current = { time: Date.now(), page: currentPageRef.current }
    return () => {
      const start = sessionStartRef.current
      if (!start) return
      const durationMs      = Date.now() - start.time
      const durationMinutes = Math.min(Math.round(durationMs / 60000), 240)
      if (durationMinutes < 1) return
      const pagesRead = Math.max(0, currentPageRef.current - start.page)
      void saveReadingSession({
        user_id: userId, book_id: bookId,
        date: new Date().toISOString().split('T')[0],
        duration_minutes: durationMinutes, pages_read: pagesRead,
      })
    }
  }, [userId, bookId])

  // ── Prefs update ──────────────────────────────────────────────────────────

  async function updatePrefs(next: Partial<ReadingPreference>) {
    if (!userId || !prefs) return
    const merged = { ...prefs, ...next }
    setPrefs(merged)
    await saveReadingPreference({
      user_id: userId, theme: merged.theme, reading_mode: merged.reading_mode,
      font_scale: merged.font_scale, line_height: merged.line_height, margin_px: merged.margin_px,
    })
  }

  // ── Annotation actions ────────────────────────────────────────────────────

  async function addHighlight() {
    if (!userId || !bookId || !highlightText.trim()) return
    await saveBookHighlight({ user_id: userId, book_id: bookId, page: currentPage, color: '#E8A838', excerpt: highlightText.trim() })
    setHighlightText('')
    setHighlights(await getBookHighlights(bookId, userId) as BookHighlight[])
    showToast('Destaque guardado')
  }

  async function addNote() {
    if (!userId || !bookId || !noteText.trim()) return
    await saveBookNote({ user_id: userId, book_id: bookId, page: currentPage, note: noteText.trim(), excerpt: currentPageData?.text.slice(0, 180) ?? null })
    setNoteText('')
    setNotes(await getBookNotes(bookId, userId) as BookNote[])
    showToast('Nota guardada')
  }

  async function toggleBookmark() {
    if (!userId || !bookId) return
    if (currentBookmark) {
      await deleteBookBookmark(currentBookmark.id, userId)
      setBookmarks(await getBookBookmarks(bookId, userId) as BookBookmark[])
      showToast('Marcador removido')
    } else {
      await saveBookBookmark({ user_id: userId, book_id: bookId, page: currentPage, label: `Página ${currentPage}` })
      setBookmarks(await getBookBookmarks(bookId, userId) as BookBookmark[])
      showToast('Marcador guardado')
    }
  }

  // ── Swipe ─────────────────────────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || readingMode !== 'paginado') return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta < -SWIPE_THRESHOLD) setCurrentPage(p => clamp(p + 1, 1, pageCount))
    if (delta >  SWIPE_THRESHOLD) setCurrentPage(p => clamp(p - 1, 1, pageCount))
  }

  // ── Shared style shortcuts ────────────────────────────────────────────────

  const iconBtn = {
    width: 36, height: 36, borderRadius: 10, border: 'none' as const,
    background: `rgba(${overlay},0.08)`,
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    cursor: 'pointer' as const, color: palette.text, flexShrink: 0,
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#10131A', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
        A carregar…
      </div>
    )
  }
  if (!book) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>
        Livro não encontrado.
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      style={{ minHeight: '100vh', background: palette.bg, color: palette.text, paddingBottom: readingMode === 'paginado' ? 150 : 100 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ── Top progress bar ──────────────────────────────────────────────── */}
      <div style={{ height: 3, background: `rgba(${overlay},0.07)`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ height: '100%', width: `${progressPct}%`, background: palette.accent, transition: 'width 0.4s ease' }} />
      </div>

      {/* ── Sticky header (auto-hides on scroll) ──────────────────────────── */}
      <div style={{
        position: 'sticky', top: 3, zIndex: 40,
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
        background: headerBg,
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${palette.border}`,
        opacity: headerVisible ? 1 : 0,
        transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 0.2s, transform 0.2s',
      }}>
        <Link href="/leitura" style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
          <div style={{ ...iconBtn }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </div>
        </Link>

        <div style={{ flex: 1, overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: palette.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {book.title}
          </div>
          <div style={{ fontSize: 10, color: `${palette.text}70`, marginTop: 1, fontFamily: 'Inter, sans-serif' }}>
            {currentChapter ? `${currentChapter.label} · ` : ''}p.&nbsp;{currentPage}&nbsp;de&nbsp;{pageCount}&nbsp;·&nbsp;{progressPct}%
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button
            onClick={() => { setSettingsOpen(v => !v); setTocOpen(false); setAnnOpen(false) }}
            style={{
              ...iconBtn,
              background: settingsOpen ? `${palette.accent}22` : iconBtn.background,
              color: settingsOpen ? palette.accent : palette.text,
              border: settingsOpen ? `1px solid ${palette.accent}55` : 'none',
              fontWeight: 700, fontSize: 13,
            }}
          >
            Aa
          </button>
          <button
            onClick={() => { setTocOpen(v => !v); setSettingsOpen(false); setAnnOpen(false) }}
            style={{
              ...iconBtn,
              background: tocOpen ? `${palette.accent}22` : iconBtn.background,
              border: tocOpen ? `1px solid ${palette.accent}55` : 'none',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Article ───────────────────────────────────────────────────────── */}
      <article style={{
        padding: `28px ${prefs?.margin_px ?? 24}px 40px`,
        fontSize: `${(prefs?.font_scale ?? 1) * 17}px`,
        lineHeight: prefs?.line_height ?? 1.8,
        fontFamily: "Georgia, 'Times New Roman', serif",
        color: palette.text,
      }}>
        {readingMode === 'scroll'
          ? pages.map(page => (
              <section key={page.pageNumber} style={{ marginBottom: 36 }}>
                <div style={{
                  fontSize: 10, color: `${palette.text}50`, marginBottom: 14,
                  textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif',
                }}>
                  Página {page.pageNumber}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{page.text || 'Sem texto extraível nesta página.'}</div>
              </section>
            ))
          : (
            <div style={{ whiteSpace: 'pre-wrap', minHeight: 320 }}>
              {currentPageData?.text || 'Sem texto extraível nesta página.'}
            </div>
          )
        }
      </article>

      {/* ── Bottom bar — paginado ──────────────────────────────────────────── */}
      {readingMode === 'paginado' && (
        <div style={{
          position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 30,
          padding: '10px 14px 13px',
          background: headerBg,
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          borderTop: `1px solid ${palette.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button onClick={() => setCurrentPage(p => clamp(p - 1, 1, pageCount))} style={{ ...iconBtn, width: 40, height: 40 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <input
              type="range" min={1} max={pageCount} value={currentPage}
              onChange={e => setCurrentPage(Number(e.target.value))}
              style={{ width: '100%', accentColor: palette.accent, cursor: 'pointer', height: 4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: `${palette.text}55`, fontFamily: 'Inter, sans-serif' }}>
              <span>p.&nbsp;{currentPage}</span>
              {minsLeft !== null && <span>~{minsLeft}&nbsp;min</span>}
              <span>{progressPct}%</span>
            </div>
          </div>

          <button
            onClick={toggleBookmark}
            style={{
              ...iconBtn, width: 40, height: 40,
              background: currentBookmark ? `${palette.accent}22` : iconBtn.background,
              color: currentBookmark ? palette.accent : palette.text,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={currentBookmark ? palette.accent : 'none'} stroke={currentBookmark ? palette.accent : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>

          <button onClick={() => setCurrentPage(p => clamp(p + 1, 1, pageCount))} style={{ ...iconBtn, width: 40, height: 40 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Annotations FAB ───────────────────────────────────────────────── */}
      <button
        onClick={() => { setAnnOpen(v => !v); setSettingsOpen(false); setTocOpen(false) }}
        aria-label="Anotações"
        style={{
          position: 'fixed',
          bottom: readingMode === 'paginado' ? 138 : 78,
          right: 18, zIndex: 35,
          width: 48, height: 48, borderRadius: 16,
          background: annOpen ? palette.accent : (isDark ? '#1E2330' : palette.panel),
          color: annOpen ? '#111' : palette.text,
          border: `1px solid ${palette.border}`,
          boxShadow: isDark ? '0 6px 24px rgba(0,0,0,0.5)' : '0 4px 18px rgba(0,0,0,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 19,
          transition: 'background 0.2s, color 0.2s',
        }}
      >
        ✏️
      </button>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 92, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
          background: isDark ? '#1E2330' : palette.panel,
          border: `1px solid ${palette.accent}55`, borderRadius: 12,
          padding: '10px 18px', fontSize: 13, color: palette.text,
          whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
          fontFamily: 'Inter, sans-serif',
        }}>
          ✓&nbsp;{toast}
        </div>
      )}

      {/* ── Resume prompt — Extra C ────────────────────────────────────────── */}
      {resumePrompt !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', background: sheetBg, borderRadius: '24px 24px 0 0',
            padding: '8px 22px 40px',
            border: `1px solid ${palette.border}`, borderBottom: 'none',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: palette.border, margin: '8px auto 22px' }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: `${palette.accent}18`, border: `1px solid ${palette.accent}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                📖
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: palette.text, marginBottom: 5, fontFamily: 'Inter, sans-serif' }}>
                  Retomar leitura?
                </div>
                <div style={{ fontSize: 14, color: `${palette.text}75`, lineHeight: 1.55, fontFamily: 'Inter, sans-serif' }}>
                  Ficaste na página&nbsp;<strong style={{ color: palette.text }}>{resumePrompt}</strong>. Continuar daí?
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setResumePrompt(null)}
                style={{
                  flex: 1, padding: '13px', borderRadius: 14,
                  border: `1px solid ${palette.border}`, background: 'transparent',
                  color: palette.text, fontFamily: 'Inter, sans-serif',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                Começar do início
              </button>
              <button
                onClick={() => { setCurrentPage(resumePrompt); setResumePrompt(null) }}
                style={{
                  flex: 1, padding: '13px', borderRadius: 14, border: 'none',
                  background: palette.accent, color: '#111',
                  fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Retomar p.&nbsp;{resumePrompt}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings bottom sheet ─────────────────────────────────────────── */}
      {settingsOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            style={{ width: '100%', background: sheetBg, borderRadius: '24px 24px 0 0', padding: '8px 0 40px', border: `1px solid ${palette.border}`, borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: palette.border, margin: '8px auto 20px' }} />
            <div style={{ padding: '0 20px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: `${palette.text}55`, fontFamily: 'Inter, sans-serif' }}>
              Aspecto
            </div>

            {/* Theme */}
            <div style={{ padding: '0 20px', marginBottom: 22 }}>
              <div style={{ fontSize: 11, color: `${palette.text}55`, marginBottom: 10, fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tema
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {([
                  { key: 'claro',   bg: '#F7F3EA', text: '#1E1C18', label: 'Claro'   },
                  { key: 'sepia',   bg: '#F3E8D2', text: '#3C2F22', label: 'Sépia'   },
                  { key: 'noturno', bg: '#10131A', text: '#E8E3D7', label: 'Noturno' },
                ] as { key: ReaderTheme; bg: string; text: string; label: string }[]).map(t => {
                  const active = currentTheme === t.key
                  return (
                    <button key={t.key} onClick={() => updatePrefs({ theme: t.key })} style={{
                      flex: 1, height: 52, borderRadius: 14,
                      border: active ? `2px solid ${palette.accent}` : `1px solid ${palette.border}`,
                      background: t.bg, color: t.text,
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Font size */}
            <div style={{ padding: '0 20px', marginBottom: 22 }}>
              <div style={{ fontSize: 11, color: `${palette.text}55`, marginBottom: 10, fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tamanho
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => updatePrefs({ font_scale: Math.max(0.85, (prefs?.font_scale ?? 1) - 0.1) })}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${palette.border}`, background: `rgba(${overlay},0.06)`, color: palette.text, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
                >
                  A−
                </button>
                <div style={{
                  flex: 1, height: 44, borderRadius: 12, background: `rgba(${overlay},0.05)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "Georgia, serif", fontSize: `${(prefs?.font_scale ?? 1) * 15}px`, color: palette.text,
                }}>
                  Texto de amostra
                </div>
                <button
                  onClick={() => updatePrefs({ font_scale: Math.min(1.6, (prefs?.font_scale ?? 1) + 0.1) })}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${palette.border}`, background: `rgba(${overlay},0.06)`, color: palette.text, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
                >
                  A+
                </button>
              </div>
            </div>

            {/* Reading mode */}
            <div style={{ padding: '0 20px', marginBottom: 22 }}>
              <div style={{ fontSize: 11, color: `${palette.text}55`, marginBottom: 10, fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Modo
              </div>
              <div style={{ display: 'flex', background: `rgba(${overlay},0.07)`, borderRadius: 12, padding: 4, gap: 4 }}>
                {([
                  { key: 'scroll',   label: 'Scroll'  },
                  { key: 'paginado', label: 'Folheio' },
                ] as { key: ReaderMode; label: string }[]).map(m => {
                  const active = readingMode === m.key
                  return (
                    <button key={m.key} onClick={() => updatePrefs({ reading_mode: m.key })} style={{
                      flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                      background: active ? (isDark ? '#0D1018' : palette.panel) : 'transparent',
                      color: active ? palette.text : `${palette.text}55`,
                      fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    }}>
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Line height */}
            <div style={{ padding: '0 20px' }}>
              <div style={{ fontSize: 11, color: `${palette.text}55`, marginBottom: 10, fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Espaçamento
              </div>
              <input
                type="range" min="1.4" max="2.2" step="0.1"
                value={prefs?.line_height ?? 1.8}
                onChange={e => updatePrefs({ line_height: Number(e.target.value) })}
                style={{ width: '100%', accentColor: palette.accent }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TOC bottom sheet ──────────────────────────────────────────────── */}
      {tocOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setTocOpen(false)}
        >
          <div
            style={{ width: '100%', maxHeight: '70vh', background: sheetBg, borderRadius: '24px 24px 0 0', border: `1px solid ${palette.border}`, borderBottom: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '8px 20px 14px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: palette.border, margin: '8px auto 16px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: `${palette.text}55`, fontFamily: 'Inter, sans-serif' }}>
                Sumário
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 16px 28px' }}>
              {toc.length === 0
                ? <div style={{ fontSize: 13, color: `${palette.text}55`, fontFamily: 'Inter, sans-serif', padding: '8px 4px' }}>Sem sumário disponível.</div>
                : toc.map(item => {
                    const active = currentChapter?.page === item.page
                    return (
                      <button
                        key={`${item.page}-${item.label}`}
                        onClick={() => { setCurrentPage(item.page); setTocOpen(false) }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                          border: 'none', borderRadius: 12, padding: '11px 14px', marginBottom: 4,
                          background: active ? `${palette.accent}18` : `rgba(${overlay},0.04)`,
                          color: active ? palette.accent : palette.text,
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          fontWeight: active ? 700 : 400, fontSize: 14,
                        }}
                      >
                        <span style={{ flex: 1, marginRight: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                        <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>p.&nbsp;{item.page}</span>
                      </button>
                    )
                  })
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Annotations bottom sheet ──────────────────────────────────────── */}
      {annOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setAnnOpen(false)}
        >
          <div
            style={{ width: '100%', maxHeight: '72vh', background: sheetBg, borderRadius: '24px 24px 0 0', border: `1px solid ${palette.border}`, borderBottom: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle + tabs */}
            <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: palette.border, margin: '8px auto 12px' }} />
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { key: 'destaques',  label: 'Destaques',  count: highlights.length  },
                  { key: 'notas',      label: 'Notas',      count: notes.length       },
                  { key: 'marcadores', label: 'Marcadores', count: bookmarks.length   },
                ] as { key: AnnTab; label: string; count: number }[]).map(t => {
                  const active = annTab === t.key
                  return (
                    <button key={t.key} onClick={() => setAnnTab(t.key)} style={{
                      flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none',
                      background: active ? `${palette.accent}18` : 'transparent',
                      color: active ? palette.accent : `${palette.text}55`,
                      fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      {t.label}
                      {t.count > 0 && (
                        <span style={{
                          background: active ? `${palette.accent}30` : `rgba(${overlay},0.09)`,
                          borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                        }}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ overflowY: 'auto', padding: '14px 16px 20px', flex: 1 }}>

              {/* Destaques */}
              {annTab === 'destaques' && (
                <>
                  <textarea
                    value={highlightText}
                    onChange={e => setHighlightText(e.target.value)}
                    placeholder="Trecho a destacar desta página..."
                    style={{
                      width: '100%', minHeight: 70, borderRadius: 12, resize: 'none',
                      border: `1px solid ${palette.border}`, padding: '10px 12px',
                      background: `rgba(${overlay},0.04)`, color: palette.text,
                      fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, lineHeight: 1.6, outline: 'none',
                    }}
                  />
                  <button
                    onClick={addHighlight}
                    disabled={!highlightText.trim()}
                    style={{
                      marginTop: 8, marginBottom: 16, width: '100%', padding: '11px', borderRadius: 12, border: 'none',
                      background: highlightText.trim() ? palette.accent : `rgba(${overlay},0.08)`,
                      color: highlightText.trim() ? '#111' : `${palette.text}50`,
                      fontWeight: 700, fontSize: 14, cursor: highlightText.trim() ? 'pointer' : 'not-allowed',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Guardar destaque
                  </button>
                  <div style={{ fontSize: 10, color: `${palette.text}50`, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    Esta página {currentHighlights.length > 0 && `· ${currentHighlights.length}`}
                  </div>
                  {currentHighlights.length === 0
                    ? <div style={{ fontSize: 13, color: `${palette.text}50`, fontFamily: 'Inter, sans-serif' }}>Sem destaques nesta página.</div>
                    : currentHighlights.map(h => (
                        <div key={h.id} style={{ marginBottom: 8, background: `${palette.accent}14`, border: `1px solid ${palette.accent}35`, borderRadius: 14, padding: '10px 12px' }}>
                          <div style={{ fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.6, color: palette.text }}>{h.excerpt}</div>
                          <button
                            onClick={() => userId && deleteBookHighlight(h.id, userId).then(async () => setHighlights(await getBookHighlights(bookId!, userId) as BookHighlight[]))}
                            style={{ marginTop: 6, background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'Inter, sans-serif' }}
                          >
                            Apagar
                          </button>
                        </div>
                      ))
                  }
                </>
              )}

              {/* Notas */}
              {annTab === 'notas' && (
                <>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="A tua nota sobre esta página..."
                    style={{
                      width: '100%', minHeight: 80, borderRadius: 12, resize: 'none',
                      border: `1px solid ${palette.border}`, padding: '10px 12px',
                      background: `rgba(${overlay},0.04)`, color: palette.text,
                      fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, lineHeight: 1.6, outline: 'none',
                    }}
                  />
                  <button
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    style={{
                      marginTop: 8, marginBottom: 16, width: '100%', padding: '11px', borderRadius: 12, border: 'none',
                      background: noteText.trim() ? palette.accent : `rgba(${overlay},0.08)`,
                      color: noteText.trim() ? '#111' : `${palette.text}50`,
                      fontWeight: 700, fontSize: 14, cursor: noteText.trim() ? 'pointer' : 'not-allowed',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Guardar nota
                  </button>
                  <div style={{ fontSize: 10, color: `${palette.text}50`, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    Esta página {currentNotes.length > 0 && `· ${currentNotes.length}`}
                  </div>
                  {currentNotes.length === 0
                    ? <div style={{ fontSize: 13, color: `${palette.text}50`, fontFamily: 'Inter, sans-serif' }}>Sem notas nesta página.</div>
                    : currentNotes.map(n => (
                        <div key={n.id} style={{ marginBottom: 8, background: `rgba(${overlay},0.05)`, border: `1px solid ${palette.border}`, borderRadius: 14, padding: '10px 12px' }}>
                          <div style={{ fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.6, color: palette.text }}>{n.note}</div>
                          <button
                            onClick={() => userId && deleteBookNote(n.id, userId).then(async () => setNotes(await getBookNotes(bookId!, userId) as BookNote[]))}
                            style={{ marginTop: 6, background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'Inter, sans-serif' }}
                          >
                            Apagar
                          </button>
                        </div>
                      ))
                  }
                </>
              )}

              {/* Marcadores */}
              {annTab === 'marcadores' && (
                <>
                  <button
                    onClick={toggleBookmark}
                    style={{
                      width: '100%', marginBottom: 16, padding: '11px', borderRadius: 12,
                      border: `1px solid ${currentBookmark ? 'rgba(226,75,74,0.4)' : palette.border}`,
                      background: currentBookmark ? 'rgba(226,75,74,0.1)' : `rgba(${overlay},0.05)`,
                      color: currentBookmark ? '#E24B4A' : palette.text,
                      fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {currentBookmark ? '✕ Remover marcador desta página' : `🔖 Marcar página ${currentPage}`}
                  </button>
                  <div style={{ fontSize: 10, color: `${palette.text}50`, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    Todos os marcadores {bookmarks.length > 0 && `· ${bookmarks.length}`}
                  </div>
                  {bookmarks.length === 0
                    ? <div style={{ fontSize: 13, color: `${palette.text}50`, fontFamily: 'Inter, sans-serif' }}>Sem marcadores guardados.</div>
                    : bookmarks.map(b => (
                        <button
                          key={b.id}
                          onClick={() => { setCurrentPage(b.page); setAnnOpen(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                            border: 'none', borderRadius: 12, padding: '11px 14px', marginBottom: 6,
                            background: `rgba(${overlay},0.05)`, color: palette.text,
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14,
                          }}
                        >
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>
                            {(b.label && b.label.trim()) || `Página ${b.page}`}
                          </span>
                          <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>p.&nbsp;{b.page}</span>
                        </button>
                      ))
                  }
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
