// src/lib/book-content.ts
// Páginas dos livros no Supabase Storage, em vez de dentro do Postgres.
//
// O texto de um livro são vários MB. Guardado em `books.raw_content`, isso
// consome o disco da base de dados — o recurso mais escasso e o mais caro de
// aumentar. No Storage não pesa no disco do Postgres.
//
// Livros importados antes desta mudança continuam com as páginas em
// `raw_content.pages` e `content_path` a NULL. `loadBookPages` trata os dois
// casos, por isso não é preciso migrar nada para a leitura voltar a funcionar.
import { supabase } from '@/lib/supabase'

export const BOOK_CONTENT_BUCKET = 'book-content'

export type BookPage = { pageNumber: number; text: string }

/** Caminho do ficheiro. O 1º segmento é o user_id — é dele que depende a RLS. */
export function bookContentPath(userId: string, bookId: string): string {
  return `${userId}/${bookId}.json`
}

/**
 * Envia as páginas para o Storage. Devolve o caminho a gravar em
 * `books.content_path`, ou o erro para quem chamou decidir (o import apaga a
 * linha se isto falhar, para não ficar um livro sem conteúdo).
 */
export async function uploadBookPages(
  userId: string,
  bookId: string,
  pages: BookPage[],
): Promise<{ path: string | null; error: string | null }> {
  const path = bookContentPath(userId, bookId)
  const body = new Blob([JSON.stringify({ pages })], { type: 'application/json' })

  const { error } = await supabase.storage
    .from(BOOK_CONTENT_BUCKET)
    .upload(path, body, { contentType: 'application/json', upsert: true })

  if (error) return { path: null, error: error.message }
  return { path, error: null }
}

/** Lê as páginas do Storage. Devolve null se falhar (rede, ficheiro em falta). */
export async function downloadBookPages(path: string): Promise<BookPage[] | null> {
  const { data, error } = await supabase.storage.from(BOOK_CONTENT_BUCKET).download(path)
  if (error || !data) return null

  try {
    const parsed = JSON.parse(await data.text()) as { pages?: unknown }
    return Array.isArray(parsed.pages) ? (parsed.pages as BookPage[]) : null
  } catch {
    return null
  }
}

/**
 * Fonte única de verdade para o leitor: usa o Storage quando o livro já lá
 * está e cai para o `raw_content` dos livros antigos.
 */
export async function loadBookPages(book: {
  content_path?: string | null
  raw_content?: { pages?: BookPage[] } | null
} | null): Promise<BookPage[]> {
  if (!book) return []

  if (book.content_path) {
    const pages = await downloadBookPages(book.content_path)
    if (pages) return pages
    // Falhou o download: ainda assim tenta o raw_content, caso seja um livro
    // a meio da transição. Melhor mostrar algo do que um leitor vazio.
  }

  return book.raw_content?.pages ?? []
}

/** Remove o ficheiro ao apagar o livro, para não deixar órfãos no bucket. */
export async function removeBookContent(path: string | null | undefined): Promise<void> {
  if (!path) return
  await supabase.storage.from(BOOK_CONTENT_BUCKET).remove([path])
}
