'use client'

import { useEffect, useMemo, useState } from 'react'
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

const themeMap: Record<ReaderTheme, { bg: string; text: string; panel: string }> = {
  claro: { bg: '#F7F3EA', text: '#1E1C18', panel: '#FFFFFF' },
  sepia: { bg: '#F3E8D2', text: '#3C2F22', panel: '#F7ECD9' },
  noturno: { bg: '#10131A', text: '#E8E3D7', panel: '#171B24' },
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function LeituraReaderPage() {
  const params = useParams<{ id: string }>()
  const bookId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [userId, setUserId] = useState<string | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('page')
    if (p) {
      const n = parseInt(p, 10)
      if (!isNaN(n) && n > 0) setCurrentPage(n)
    }
  }, [])

  const [tocOpen, setTocOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [highlightText, setHighlightText] = useState('')
  const [bookmarkLabel, setBookmarkLabel] = useState('')
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [notes, setNotes] = useState<BookNote[]>([])
  const [bookmarks, setBookmarks] = useState<BookBookmark[]>([])
  const [prefs, setPrefs] = useState<ReadingPreference | null>(null)
  const [toast, setToast] = useState('')

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadAll(uid: string, id: string) {
    const [nextBook, progress, nextHighlights, nextNotes, nextBookmarks, nextPrefs] = await Promise.all([
      getBookById(id, uid),
      getBookProgress(id, uid),
      getBookHighlights(id, uid),
      getBookNotes(id, uid),
      getBookBookmarks(id, uid),
      getReadingPreference(uid),
    ])

    setBook(nextBook as Book | null)
    setHighlights((nextHighlights ?? []) as BookHighlight[])
    setNotes((nextNotes ?? []) as BookNote[])
    setBookmarks((nextBookmarks ?? []) as BookBookmark[])
    setPrefs((nextPrefs as ReadingPreference | null) ?? {
      id: 'local',
      user_id: uid,
      theme: 'sepia',
      reading_mode: 'scroll',
      font_scale: 1,
      line_height: 1.7,
      margin_px: 20,
      updated_at: new Date().toISOString(),
    })
    const pageParam = new URLSearchParams(window.location.search).get('page')
    const requestedPage = pageParam ? parseInt(pageParam, 10) : NaN
    const initialPage = !isNaN(requestedPage) && requestedPage > 0
      ? requestedPage
      : progress?.current_page ?? 1
    setCurrentPage(clamp(initialPage, 1, nextBook?.raw_content?.pageCount ?? 1))
  }

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      if (!bookId) return
      if (!active) return
      setUserId(user.id)
      await loadAll(user.id, bookId)
      if (!active) return
      setLoading(false)
    }
    bootstrap()
    return () => { active = false }
  }, [bookId])

  const pages = book?.raw_content?.pages ?? []
  const pageCount = book?.raw_content?.pageCount ?? 1
  const currentPageData = pages.find((page) => page.pageNumber === currentPage) ?? pages[0]
  const toc = book?.raw_content?.toc ?? []
  const currentHighlights = highlights.filter((item) => item.page === currentPage)
  const currentNotes = notes.filter((item) => item.page === currentPage)
  const currentBookmark = bookmarks.find((item) => item.page === currentPage)
  const palette = themeMap[prefs?.theme ?? 'sepia']

  useEffect(() => {
    async function persistProgress() {
      if (!userId || !bookId || !book) return
      const pct = Math.round((currentPage / Math.max(pageCount, 1)) * 100)
      await saveBookProgress({ user_id: userId, book_id: bookId, current_page: currentPage, progress_pct: pct })
    }
    persistProgress()
  }, [userId, bookId, book, currentPage, pageCount])

  async function updatePrefs(next: Partial<ReadingPreference>) {
    if (!userId || !prefs) return
    const merged = { ...prefs, ...next }
    setPrefs(merged)
    await saveReadingPreference({
      user_id: userId,
      theme: merged.theme,
      reading_mode: merged.reading_mode,
      font_scale: merged.font_scale,
      line_height: merged.line_height,
      margin_px: merged.margin_px,
    })
  }

  async function addHighlight() {
    if (!userId || !bookId || !highlightText.trim()) return
    const { error } = await saveBookHighlight({ user_id: userId, book_id: bookId, page: currentPage, color: '#E8A838', excerpt: highlightText.trim() })
    if (!error) {
      setHighlightText('')
      setHighlights(await getBookHighlights(bookId, userId) as BookHighlight[])
      showToast('Destaque guardado.')
    }
  }

  async function addNote() {
    if (!userId || !bookId || !noteText.trim()) return
    const { error } = await saveBookNote({ user_id: userId, book_id: bookId, page: currentPage, note: noteText.trim(), excerpt: currentPageData?.text.slice(0, 180) ?? null })
    if (!error) {
      setNoteText('')
      setNotes(await getBookNotes(bookId, userId) as BookNote[])
      showToast('Nota guardada.')
    }
  }

  async function toggleBookmark() {
    if (!userId || !bookId) return
    if (currentBookmark) {
      await deleteBookBookmark(currentBookmark.id, userId)
      setBookmarks(await getBookBookmarks(bookId, userId) as BookBookmark[])
      showToast('Marcador removido.')
      return
    }
    await saveBookBookmark({ user_id: userId, book_id: bookId, page: currentPage, label: bookmarkLabel.trim() || `Página ${currentPage}` })
    setBookmarkLabel('')
    setBookmarks(await getBookBookmarks(bookId, userId) as BookBookmark[])
    showToast('Marcador guardado.')
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>a carregar…</div>
  }

  if (!book) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>Livro não encontrado.</div>
  }

  return (
    <main style={{ minHeight: '100vh', background: palette.bg, color: palette.text, paddingBottom: 110 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: palette.panel, border: '0.5px solid rgba(232,168,56,.35)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: palette.text }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ padding: '18px 16px 0', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/leitura" style={{ textDecoration: 'none', color: 'inherit', fontSize: 13 }}>← Leitura</Link>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSettingsOpen((v) => !v)} style={{ border: '0.5px solid rgba(0,0,0,.12)', borderRadius: 10, background: settingsOpen ? 'var(--gold)' : palette.panel, padding: '8px 12px', cursor: 'pointer', color: settingsOpen ? '#111' : palette.text, fontSize: 13 }}>Aa</button>
            <button onClick={() => setTocOpen((v) => !v)} style={{ border: '0.5px solid rgba(0,0,0,.12)', borderRadius: 10, background: palette.panel, padding: '8px 12px', cursor: 'pointer', color: palette.text }}>Sumário</button>
          </div>
        </div>

        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, margin: 0 }}>{book.title}</h1>
          <div style={{ fontSize: 12, opacity: .72, marginTop: 6 }}>Página {currentPage} de {pageCount}</div>
        </div>

        {settingsOpen && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              <div style={{ background: palette.panel, borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 11, opacity: .7 }}>Modo</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {(['scroll', 'paginado'] as ReaderMode[]).map((mode) => (
                    <button key={mode} onClick={() => updatePrefs({ reading_mode: mode })} style={{ flex: 1, borderRadius: 10, border: 'none', padding: '9px 10px', background: (prefs?.reading_mode ?? 'scroll') === mode ? 'var(--gold)' : 'rgba(0,0,0,.08)', color: (prefs?.reading_mode ?? 'scroll') === mode ? '#111' : palette.text, cursor: 'pointer' }}>{mode === 'scroll' ? 'Scroll' : 'Folheio'}</button>
                  ))}
                </div>
              </div>
              <div style={{ background: palette.panel, borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 11, opacity: .7 }}>Tema</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {(['claro', 'sepia', 'noturno'] as ReaderTheme[]).map((theme) => (
                    <button key={theme} onClick={() => updatePrefs({ theme })} style={{ flex: 1, borderRadius: 10, border: 'none', padding: '9px 8px', background: (prefs?.theme ?? 'sepia') === theme ? 'var(--gold)' : 'rgba(0,0,0,.08)', color: (prefs?.theme ?? 'sepia') === theme ? '#111' : palette.text, cursor: 'pointer', fontSize: 12 }}>{theme}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: palette.panel, borderRadius: 14, padding: 12, display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                Tamanho da fonte
                <input type="range" min="0.9" max="1.5" step="0.05" value={prefs?.font_scale ?? 1} onChange={(e) => updatePrefs({ font_scale: Number(e.target.value) })} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                Espaçamento entre linhas
                <input type="range" min="1.4" max="2.2" step="0.1" value={prefs?.line_height ?? 1.7} onChange={(e) => updatePrefs({ line_height: Number(e.target.value) })} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                Margens
                <input type="range" min="14" max="40" step="2" value={prefs?.margin_px ?? 20} onChange={(e) => updatePrefs({ margin_px: Number(e.target.value) })} />
              </label>
            </div>
          </>
        )}

        {tocOpen && (
          <div style={{ background: palette.panel, borderRadius: 14, padding: 12, display: 'grid', gap: 8 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>Sumário</div>
            {toc.map((item) => (
              <button key={`${item.page}-${item.label}`} onClick={() => { setCurrentPage(item.page); setTocOpen(false) }} style={{ textAlign: 'left', border: 'none', background: 'rgba(0,0,0,.06)', color: palette.text, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                {item.label} <span style={{ opacity: .6 }}>· p. {item.page}</span>
              </button>
            ))}
          </div>
        )}

        <article style={{ background: palette.panel, borderRadius: 18, padding: `${prefs?.margin_px ?? 20}px`, fontSize: `${(prefs?.font_scale ?? 1) * 17}px`, lineHeight: prefs?.line_height ?? 1.7, whiteSpace: 'pre-wrap' }}>
          {(prefs?.reading_mode ?? 'scroll') === 'scroll'
            ? pages.map((page) => (
                <section key={page.pageNumber} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, opacity: .55, marginBottom: 10 }}>Página {page.pageNumber}</div>
                  <div>{page.text || 'Sem texto extraível nesta página.'}</div>
                </section>
              ))
            : <div>{currentPageData?.text || 'Sem texto extraível nesta página.'}</div>}
        </article>

        {(prefs?.reading_mode ?? 'scroll') === 'paginado' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setCurrentPage((p) => clamp(p - 1, 1, pageCount))} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '12px 14px', background: palette.panel, color: palette.text, cursor: 'pointer' }}>← Anterior</button>
            <button onClick={() => setCurrentPage((p) => clamp(p + 1, 1, pageCount))} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '12px 14px', background: 'var(--gold)', color: '#111', cursor: 'pointer' }}>Seguinte →</button>
          </div>
        )}

        <div style={{ background: palette.panel, borderRadius: 16, padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>Estudo e marcação</div>

          <textarea value={highlightText} onChange={(e) => setHighlightText(e.target.value)} placeholder="Trecho para destacar nesta página" style={{ minHeight: 72, borderRadius: 12, border: '0.5px solid rgba(0,0,0,.12)', padding: 12, background: 'transparent', color: palette.text }} />
          <button onClick={addHighlight} style={{ border: 'none', borderRadius: 12, padding: '11px 14px', background: 'var(--gold)', color: '#111', cursor: 'pointer', fontWeight: 700 }}>Guardar destaque</button>

          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Nota da página" style={{ minHeight: 84, borderRadius: 12, border: '0.5px solid rgba(0,0,0,.12)', padding: 12, background: 'transparent', color: palette.text }} />
          <button onClick={addNote} style={{ border: 'none', borderRadius: 12, padding: '11px 14px', background: 'rgba(0,0,0,.08)', color: palette.text, cursor: 'pointer', fontWeight: 700 }}>Guardar nota</button>

          <input value={bookmarkLabel} onChange={(e) => setBookmarkLabel(e.target.value)} placeholder="Nome do marcador" style={{ borderRadius: 12, border: '0.5px solid rgba(0,0,0,.12)', padding: 12, background: 'transparent', color: palette.text }} />
          <button onClick={toggleBookmark} style={{ border: 'none', borderRadius: 12, padding: '11px 14px', background: currentBookmark ? '#E24B4A' : 'rgba(0,0,0,.08)', color: currentBookmark ? '#fff' : palette.text, cursor: 'pointer', fontWeight: 700 }}>
            {currentBookmark ? 'Remover marcador desta página' : 'Guardar marcador'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <section style={{ background: palette.panel, borderRadius: 16, padding: 14 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 10 }}>Destaques da página</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {currentHighlights.length === 0 ? <div style={{ fontSize: 12, opacity: .65 }}>Sem destaques nesta página.</div> : currentHighlights.map((item) => (
                <div key={item.id} style={{ background: 'rgba(232,168,56,.14)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13 }}>{item.excerpt}</div>
                  <button onClick={() => userId && deleteBookHighlight(item.id, userId).then(async () => setHighlights(await getBookHighlights(bookId!, userId) as BookHighlight[]))} style={{ marginTop: 8, border: 'none', background: 'transparent', color: '#E24B4A', cursor: 'pointer', padding: 0 }}>Apagar</button>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: palette.panel, borderRadius: 16, padding: 14 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 10 }}>Notas da página</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {currentNotes.length === 0 ? <div style={{ fontSize: 12, opacity: .65 }}>Sem notas nesta página.</div> : currentNotes.map((item) => (
                <div key={item.id} style={{ background: 'rgba(0,0,0,.06)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13 }}>{item.note}</div>
                  <button onClick={() => userId && deleteBookNote(item.id, userId).then(async () => setNotes(await getBookNotes(bookId!, userId) as BookNote[]))} style={{ marginTop: 8, border: 'none', background: 'transparent', color: '#E24B4A', cursor: 'pointer', padding: 0 }}>Apagar</button>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: palette.panel, borderRadius: 16, padding: 14 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 10 }}>Marcadores</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {bookmarks.length === 0 ? <div style={{ fontSize: 12, opacity: .65 }}>Sem marcadores guardados.</div> : bookmarks.map((item) => (
                <button key={item.id} onClick={() => setCurrentPage(item.page)} style={{ textAlign: 'left', border: 'none', borderRadius: 12, padding: 12, background: 'rgba(0,0,0,.06)', color: palette.text, cursor: 'pointer' }}>
                  {(item.label && item.label.trim()) || `Página ${item.page}`} <span style={{ opacity: .6 }}>· p. {item.page}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <Nav />
    </main>
  )
}
