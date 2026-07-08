'use client'

import type { FinancialImportCandidate, FinancialImportPreview, PdfImportResult } from '@/types'
import { suggestCategory } from '@/lib/categorize'

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
      if ((existing as HTMLScriptElement).dataset.loaded === 'true') return resolve()
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
      if (!window.pdfjsLib) throw new Error('Biblioteca de PDF não ficou disponível.')
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

export async function extractPdfText(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfImportResult> {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Ficheiro inválido. Envia um PDF.')
  }

  await ensurePdfJs()

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const pdf = await window.pdfjsLib!.getDocument({ data: bytes }).promise

  const pages = []
  const warnings: string[] = []

  onProgress?.(0, pdf.numPages)
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = normalizePdfText(
      content.items.map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join('')
    )
    pages.push({ pageNumber, text })
    onProgress?.(pageNumber, pdf.numPages)
  }

  const extractedText = normalizePdfText(
    pages.map((page) => page.text).filter(Boolean).join('\n\n')
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

const DATE_PATTERNS = [
  /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/,
  /(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})/,
  /(\d{2})[\/\-.](\d{2})/,
]

const AMOUNT_PATTERN = /-?\s*\d{1,3}(?:\.\d{3})*,\d{2}-?|[-+]?\s*\d+(?:,\d{2})/

function toIsoDate(fragment: string): string | null {
  const clean = fragment.trim().replace(/\./g, '/').replace(/-/g, '/')
  const parts = clean.split('/')
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  }
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  if (parts.length === 2) {
    const year = new Date().getFullYear()
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return null
}

function parseAmount(fragment: string): number | null {
  const negative = fragment.includes('-') && !fragment.trim().startsWith('+')
  const normalized = fragment.replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/-/g, '')
  const value = Number.parseFloat(normalized)
  if (Number.isNaN(value)) return null
  return negative ? Math.abs(value) * -1 : value
}

function guessType(amount: number | null, text: string): 'entrada' | 'saida' | null {
  if (amount === null) return null
  if (amount < 0) return 'saida'
  const lowered = text.toLowerCase()
  if (/(sal[áa]rio|transfer[êe]ncia recebida|reembolso|dep[oó]sito|cr[eé]dito)/.test(lowered)) return 'entrada'
  if (/(pagamento|compra|d[eé]bito|cart[aã]o|levantamento|mb way|transfer[êe]ncia enviada)/.test(lowered)) return 'saida'
  return amount >= 0 ? 'saida' : 'entrada'
}

function cleanDescription(line: string, dateMatch: string | null, amountMatch: string | null) {
  let next = line
  if (dateMatch) next = next.replace(dateMatch, ' ')
  if (amountMatch) next = next.replace(amountMatch, ' ')
  return next.replace(/\s{2,}/g, ' ').replace(/[|]+/g, ' ').trim()
}

function confidenceForCandidate(date: string | null, amount: number | null, description: string): 'high' | 'medium' | 'low' {
  if (date && amount !== null && description.length >= 4) return 'high'
  if ((date || amount !== null) && description.length >= 3) return 'medium'
  return 'low'
}

export function parseStatementPdf(result: PdfImportResult): FinancialImportPreview {
  const lines = result.extractedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const candidates: FinancialImportCandidate[] = []
  const skippedLines: string[] = []

  lines.forEach((line, index) => {
    const dateMatch = DATE_PATTERNS.map((pattern) => line.match(pattern)?.[0] ?? null).find(Boolean) ?? null
    const amountMatch = line.match(AMOUNT_PATTERN)?.[0] ?? null
    const amount = amountMatch ? parseAmount(amountMatch) : null
    const description = cleanDescription(line, dateMatch, amountMatch)
    const isoDate = dateMatch ? toIsoDate(dateMatch) : null
    const type = guessType(amount, line)
    const confidence = confidenceForCandidate(isoDate, amount, description)

    if (!dateMatch || amount === null || description.length < 3) {
      if (skippedLines.length < 20 && /\d/.test(line)) skippedLines.push(line)
      return
    }

    candidates.push({
      id: `pdf-${index}`,
      date: isoDate,
      description,
      amount: Math.abs(amount),
      type,
      category: suggestCategory(description, type),
      confidence,
      raw: line,
      selected: confidence !== 'low',
    })
  })

  const warnings = [...result.warnings]
  if (candidates.length === 0) {
    warnings.push('Não consegui identificar linhas de movimento com confiança suficiente neste PDF.')
  }
  if (skippedLines.length > 0) {
    warnings.push('Algumas linhas ficaram de fora e podem precisar de revisão manual.')
  }

  return {
    source: 'pdf',
    fileName: result.meta.fileName,
    rawText: result.extractedText,
    candidates,
    skippedLines,
    warnings,
  }
}
