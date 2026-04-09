'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import FileImportModal from '@/components/FileImportModal'
import { supabase, getBooks, getBookProgress, saveBook } from '@/lib/supabase'
import type { Book, BookProgress, FileImportResult } from '@/types'

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
          /^(cap[ií]tulo|chapter|parte|sec[cç][aã]o)\b/i.test(line) ||
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

export default function LeituraPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [toast, setToast] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, BookProgress | null>>({})

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

    setProgressMap(Object.fromEntries(pairs))
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/auth'
        return
      }

      if (!active) return

      setUserId(user.id)
      await loadData(user.id)

      if (!active) return
      setLoading(false)
    }

    bootstrap()

    return () => {
      active = false
    }
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

    if (error) {
      showToast('Erro ao importar ebook.')
      return
    }

    await loadData(userId)
    setShowImport(false)
    showToast('Ebook importado com sucesso.')
  }

  const stats = useMemo(() => {
    const total = books.length
    const inProgress = books.filter((book) => {
      const pct = progressMap[book.id]?.progress_pct ?? 0
      return pct > 0 && pct < 100
    }).length
    const completed = books.filter((book) => (progressMap[book.id]?.progress_pct ?? 0) >= 100).length

    return { total, inProgress, completed }
  }, [books, progressMap])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text3)',
        }}
      >
        a carregar…
      </div>
    )
  }

  return (
    <main style={{ minHeight: '100vh', paddingBottom: 100 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 88,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'var(--bg2)',
            border: '0.5px solid rgba(30,203,180,.35)',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 13,
            color: 'var(--teal)',
          }}
        >
          ✓ {toast}
        </div>
      )}

      <div style={{ padding: '28px 20px 0' }}>
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 22,
            marginBottom: 4,
          }}
        >
          Leitura
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>
          Biblioteca pessoal com reader, progresso, notas, destaques e marcadores.
        </p>
      </div>

      <div
        style={{
          padding: '14px 20px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 10,
        }}
      >
        {[
          { label: 'Livros', value: stats.total, color: 'var(--gold)' },
          { label: 'Em leitura', value: stats.inProgress, color: 'var(--teal)' },
          { label: 'Concluídos', value: stats.completed, color: 'var(--text2)' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: 'var(--bg2)',
              border: '0.5px solid var(--border)',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.label}</div>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 6,
                color: item.color,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 20px 0' }}>
        <button
          onClick={() => setShowImport(true)}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 14,
            padding: '14px 16px',
            background: 'var(--gold)',
            color: 'var(--bg0)',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Importar ebook PDF
        </button>
      </div>

      <section style={{ padding: '14px 20px 0', display: 'grid', gap: 12 }}>
        {books.length === 0 ? (
          <div
            style={{
              background: 'var(--bg2)',
              border: '0.5px solid var(--border)',
              borderRadius: 16,
              padding: 16,
              color: 'var(--text2)',
              fontSize: 13,
            }}
          >
            Ainda não tens ebooks na biblioteca.
          </div>
        ) : (
          books.map((book) => {
            const progress = progressMap[book.id]
            const pct = Math.round(progress?.progress_pct ?? 0)
            const currentPage = progress?.current_page ?? 1

            return (
              <Link
                key={book.id}
                href={`/leitura/${book.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'var(--bg2)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 18,
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(232,168,56,.18), rgba(30,203,180,.14))',
                    border: '0.5px solid rgba(255,255,255,.08)',
                    borderRadius: 14,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 800,
                    fontSize: 22,
                    color: 'var(--gold)',
                    minHeight: 74,
                  }}
                >
                  {book.cover_label ?? book.title.slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <div
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {book.title}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    {book.source_file_name ?? 'PDF importado'}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      height: 8,
                      background: 'var(--bg1)',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--gold)',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      fontSize: 11,
                      color: 'var(--text3)',
                    }}
                  >
                    <span>{pct}% lido</span>
                    <span>Página {currentPage}</span>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </section>

      <FileImportModal
        open={showImport}
        title="Importar ebook"
        kind="pdf"
        onClose={() => setShowImport(false)}
        onConfirm={handleImport}
        confirmLabel="Guardar ebook"
      />

      <Nav />
    </main>
  )
}