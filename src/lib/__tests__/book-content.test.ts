import { describe, it, expect, vi, beforeEach } from 'vitest'

const download = vi.fn()
const upload = vi.fn()
const remove = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ download, upload, remove }) } },
}))

const { loadBookPages, bookContentPath, downloadBookPages, removeBookContent } =
  await import('@/lib/book-content')

const PAGES = [{ pageNumber: 1, text: 'primeira' }, { pageNumber: 2, text: 'segunda' }]

function blobOf(value: unknown) {
  return { text: async () => JSON.stringify(value) }
}

beforeEach(() => {
  download.mockReset(); upload.mockReset(); remove.mockReset()
})

describe('bookContentPath', () => {
  // O 1º segmento tem de ser o user_id: e dele que depende a RLS do bucket.
  it('poe o user_id como primeiro segmento', () => {
    expect(bookContentPath('user-1', 'book-9')).toBe('user-1/book-9.json')
  })
})

describe('loadBookPages', () => {
  it('le do Storage quando o livro tem content_path', async () => {
    download.mockResolvedValue({ data: blobOf({ pages: PAGES }), error: null })

    const pages = await loadBookPages({ content_path: 'u/b.json', raw_content: null })

    expect(pages).toEqual(PAGES)
    expect(download).toHaveBeenCalledWith('u/b.json')
  })

  // Compatibilidade: livros importados antes da mudanca continuam a abrir.
  it('cai para raw_content nos livros antigos (sem content_path)', async () => {
    const pages = await loadBookPages({ content_path: null, raw_content: { pages: PAGES } })

    expect(pages).toEqual(PAGES)
    expect(download).not.toHaveBeenCalled()
  })

  it('se o download falhar, ainda tenta o raw_content', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'offline' } })

    const pages = await loadBookPages({ content_path: 'u/b.json', raw_content: { pages: PAGES } })

    expect(pages).toEqual(PAGES)
  })

  it('devolve lista vazia quando nao ha conteudo em lado nenhum', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'x' } })

    expect(await loadBookPages({ content_path: 'u/b.json', raw_content: null })).toEqual([])
    expect(await loadBookPages(null)).toEqual([])
  })
})

describe('downloadBookPages', () => {
  it('devolve null em JSON invalido em vez de rebentar', async () => {
    download.mockResolvedValue({ data: { text: async () => 'nao-e-json' }, error: null })
    expect(await downloadBookPages('u/b.json')).toBeNull()
  })

  it('devolve null quando o ficheiro nao tem `pages`', async () => {
    download.mockResolvedValue({ data: blobOf({ outraCoisa: 1 }), error: null })
    expect(await downloadBookPages('u/b.json')).toBeNull()
  })
})

describe('removeBookContent', () => {
  it('nao chama o Storage sem caminho (livros antigos)', async () => {
    await removeBookContent(null)
    await removeBookContent(undefined)
    expect(remove).not.toHaveBeenCalled()
  })

  it('remove o ficheiro quando ha caminho', async () => {
    remove.mockResolvedValue({ error: null })
    await removeBookContent('u/b.json')
    expect(remove).toHaveBeenCalledWith(['u/b.json'])
  })
})
