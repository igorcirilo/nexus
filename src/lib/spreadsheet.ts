'use client'

import type { SpreadsheetImportResult, SpreadsheetSheetPreview } from '@/types'

declare global {
  interface Window {
    XLSX?: {
      read: (data: ArrayBuffer | Uint8Array | string, options?: Record<string, unknown>) => {
        SheetNames: string[]
        Sheets: Record<string, unknown>
      }
      utils: {
        sheet_to_json: (
          sheet: unknown,
          options?: Record<string, unknown>
        ) => Array<Record<string, string | number | boolean | null>>
      }
    }
  }
}

const SHEETJS_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'

let xlsxLoader: Promise<void> | null = null

function ensureBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Leitura de planilhas disponível apenas no browser.')
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

async function ensureSheetJs() {
  ensureBrowser()
  if (window.XLSX) return
  if (!xlsxLoader) {
    xlsxLoader = loadScript(SHEETJS_SRC).then(() => {
      if (!window.XLSX) throw new Error('Biblioteca de planilhas não ficou disponível.')
    })
  }
  await xlsxLoader
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === undefined || value === '') return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value === null) return null
  return String(value)
}

function buildSheetPreview(name: string, rows: Array<Record<string, unknown>>): SpreadsheetSheetPreview {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => {
        if (key !== '__rowNum__' && key !== '') set.add(key)
      })
      return set
    }, new Set<string>())
  )

  const normalizedRows = rows.slice(0, 25).map((row) => {
    const normalized: Record<string, string | number | boolean | null> = {}
    headers.forEach((header) => {
      normalized[header] = normalizeCell(row[header])
    })
    return normalized
  })

  return {
    name,
    headers,
    rows: normalizedRows,
    rowCount: rows.length,
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === ',' && !insideQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

async function parseCsv(file: File): Promise<SpreadsheetImportResult> {
  const text = await file.text()
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  if (lines.length === 0) {
    throw new Error('CSV vazio.')
  }

  const headers = parseCsvLine(lines[0]).map((header, index) => header || `Coluna ${index + 1}`)
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return headers.reduce<Record<string, string | number | boolean | null>>((acc, header, index) => {
      acc[header] = normalizeCell(cells[index] ?? null)
      return acc
    }, {})
  })

  return {
    kind: 'spreadsheet',
    meta: {
      fileName: file.name,
      fileType: file.type || 'text/csv',
      fileSize: file.size,
    },
    sheets: [
      {
        name: 'CSV',
        headers,
        rows: rows.slice(0, 25),
        rowCount: rows.length,
      },
    ],
    warnings: rows.length === 0 ? ['O ficheiro tem cabeçalhos mas não tem linhas de dados.'] : [],
  }
}

export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetImportResult> {
  const lowerName = file.name.toLowerCase()
  const isCsv = lowerName.endsWith('.csv') || file.type.includes('csv')

  if (isCsv) {
    return parseCsv(file)
  }

  const isSpreadsheet =
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    file.type.includes('sheet') ||
    file.type.includes('excel')

  if (!isSpreadsheet) {
    throw new Error('Ficheiro inválido. Envia .xlsx, .xls ou .csv.')
  }

  await ensureSheetJs()

  const buffer = await file.arrayBuffer()
  const workbook = window.XLSX!.read(buffer, { type: 'array' })

  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const rows = window.XLSX!.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false,
    }) as Array<Record<string, unknown>>
    return buildSheetPreview(sheetName, rows)
  })

  const warnings: string[] = []
  if (sheets.every((sheet) => sheet.rowCount === 0)) {
    warnings.push('A planilha foi lida, mas não foram encontradas linhas com dados.')
  }

  return {
    kind: 'spreadsheet',
    meta: {
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    },
    sheets,
    warnings,
  }
}
