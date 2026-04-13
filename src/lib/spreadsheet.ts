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
        ) => Array<Record<string, string | number | boolean | null>> | Array<Array<string | number | boolean | null>>
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

function normalizeHeaderText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function looksLikeTrainingHeaderRow(cells: Array<string | number | boolean | null>) {
  const normalized = cells
    .map((cell) => normalizeHeaderText(String(cell ?? '')))
    .filter(Boolean)

  if (normalized.length === 0) return false

  const markers = [
    'exercicio',
    'exercício',
    'series',
    'serie',
    'reps alvo',
    'repeticoes',
    'descanso',
    'carga',
    'carga (kg)',
    'reps feitas',
    'concluido',
    'concluído',
  ]

  const score = normalized.reduce((sum, cell) => (
    markers.some((marker) => cell.includes(normalizeHeaderText(marker))) ? sum + 1 : sum
  ), 0)

  return score >= 2 && normalized.some((cell) => cell.includes('exercicio') || cell.includes('serie') || cell.includes('rep'))
}

function looksLikeDietHeaderRow(cells: Array<string | number | boolean | null>) {
  const normalized = cells
    .map((cell) => normalizeHeaderText(String(cell ?? '')))
    .filter(Boolean)

  if (normalized.length === 0) return false

  const markers = [
    'refeicao',
    'refeição',
    'alimento',
    'quantidade',
    'calorias',
    'calorias (kcal)',
    'kcal',
    'proteinas',
    'proteínas',
    'carboidratos',
    'gorduras',
  ]

  const score = normalized.reduce((sum, cell) => (
    markers.some((marker) => cell.includes(normalizeHeaderText(marker))) ? sum + 1 : sum
  ), 0)

  return score >= 3 && normalized.some((cell) => cell.includes('refeicao') || cell.includes('alimento'))
}

function rowFromCells(
  cells: Array<string | number | boolean | null>,
  headers: string[]
): Record<string, string | number | boolean | null> {
  return headers.reduce<Record<string, string | number | boolean | null>>((acc, header, index) => {
    acc[header] = normalizeCell(cells[index] ?? null)
    return acc
  }, {})
}

function buildSheetPreviewFromMatrix(
  name: string,
  matrix: Array<Array<string | number | boolean | null>>
): SpreadsheetSheetPreview {
  const rows = matrix
    .map((row) => row.map((cell) => normalizeCell(cell)))
    .filter((row) => row.some((cell) => cell !== null && String(cell).trim() !== ''))

  if (rows.length === 0) {
    return {
      name,
      headers: [],
      rows: [],
      rowCount: 0,
    }
  }

  const headerIndex = rows.findIndex((row) => looksLikeTrainingHeaderRow(row) || looksLikeDietHeaderRow(row))

  if (headerIndex === -1) {
    const width = Math.max(...rows.map((row) => row.length))
    const headers = Array.from({ length: width }, (_, index) => `Coluna ${index + 1}`)
    return {
      name,
      headers,
      rows: rows.map((row) => rowFromCells(row, headers)),
      rowCount: rows.length,
    }
  }

  const headerRow = rows[headerIndex]
  const detectedHeaders = headerRow.map((cell, index) => {
    const value = String(cell ?? '').trim()
    return value || `Coluna ${index + 1}`
  })

  const preHeaderRows = rows.slice(0, headerIndex).map((row) => {
    const content = row
      .map((cell) => String(cell ?? '').trim())
      .filter(Boolean)
      .join(' ')

    return { __line__: content }
  }).filter((row) => row.__line__)

  const dataRows = rows.slice(headerIndex + 1).map((row) => rowFromCells(row, detectedHeaders))

  return {
    name,
    headers: detectedHeaders,
    rows: [...preHeaderRows, ...dataRows],
    rowCount: preHeaderRows.length + dataRows.length,
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
    const matrix = window.XLSX!.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
    }) as Array<Array<string | number | boolean | null>>
    return buildSheetPreviewFromMatrix(sheetName, matrix)
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
