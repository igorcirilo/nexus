'use client'

import type { PdfImportResult } from '@/types'

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string }
      getDocument: (src: { data: Uint8Array }) => {
        promise: Promise<{
          numPages: number
          getPage: (pageNumber: number) => Promise<{
            getTextContent: () => Promise<{
              items: Array<{ str?: string; hasEOL?: boolean }>
            }>
          }>
        }>
      }
    }
  }
}

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

let pdfJsLoader: Promise<void> | null = null

function ensureBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Leitura de PDF disponível apenas no browser.')
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if ((existing as any).dataset.loaded === 'true') return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.src = src
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`))
    document.head.appendChild(script)
  })
}

async function ensurePdfJs() {
  ensureBrowser()
  if (window.pdfjsLib) return
  if (!pdfJsLoader) {
    pdfJsLoader = (async () => {
      await loadScript(PDFJS_SRC)
      if (!window.pdfjsLib) {
        throw new Error('Biblioteca de PDF não ficou disponível.')
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC
    })()
  }
  await pdfJsLoader
}

function normalizePdfText(input: string) {
  return input
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function extractPdfText(file: File): Promise<PdfImportResult> {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Ficheiro inválido. Envia um PDF.')
  }

  await ensurePdfJs()

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const pdf = await window.pdfjsLib!.getDocument({ data: bytes }).promise

  const pages = []
  const warnings: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = normalizePdfText(
      content.items.map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join('')
    )
    pages.push({
      pageNumber,
      text,
    })
  }

  const extractedText = normalizePdfText(
    pages
      .map((page) => page.text)
      .filter(Boolean)
      .join('\n\n')
  )

  const hasUsefulText = extractedText.replace(/\s/g, '').length >= 20

  if (!hasUsefulText) {
    warnings.push('O PDF foi aberto, mas quase não tem texto extraível. Pode ser um scan/imagem.')
  }

  return {
    kind: 'pdf',
    meta: {
      fileName: file.name,
      fileType: file.type || 'application/pdf',
      fileSize: file.size,
    },
    pageCount: pdf.numPages,
    extractedText,
    pages,
    hasUsefulText,
    warnings,
  }
}
