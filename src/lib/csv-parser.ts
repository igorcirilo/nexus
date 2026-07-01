// src/lib/csv-parser.ts

import { suggestCategory } from '@/lib/categorize'

export type CsvRow = Record<string, string>

export type ParsedCsvResult = {
  headers: string[]
  rows: CsvRow[]
  separator: ',' | ';'
}

/** Deteta separador dominante na primeira linha */
function detectSeparator(firstLine: string): ',' | ';' {
  const commas     = (firstLine.match(/,/g) ?? []).length
  const semicolons = (firstLine.match(/;/g) ?? []).length
  return semicolons >= commas ? ';' : ','
}

/** Parseia CSV respeitando campos entre aspas */
function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/** Normaliza valor monetário: "1.234,56" → 1234.56 | "1234.56" → 1234.56 */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '')
  // Formato europeu: 1.234,56
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  // Formato com vírgula decimal: 1234,56
  if (/^\d+,\d+$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  return parseFloat(cleaned) || 0
}

/** Normaliza data: DD/MM/YYYY ou YYYY-MM-DD → YYYY-MM-DD */
export function parseDate(value: string): string {
  const dmY = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2,'0')}-${dmY[1].padStart(2,'0')}`
  const ymd = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`
  return value
}

/** Infere tipo (entrada/saida) a partir de texto ou sinal do valor */
export function inferType(typeField: string, amount: number): 'entrada' | 'saida' {
  const norm = typeField.toLowerCase()
  if (norm.includes('entrada') || norm.includes('receita') || norm.includes('credit')) return 'entrada'
  if (norm.includes('saida') || norm.includes('saída') || norm.includes('despesa') || norm.includes('debit')) return 'saida'
  return amount >= 0 ? 'entrada' : 'saida'
}

/** Tenta encontrar coluna por lista de candidatos (case-insensitive, sem acentos) */
function findCol(headers: string[], candidates: string[]): string | null {
  const norm = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  for (const c of candidates) {
    const idx = norm.indexOf(c)
    if (idx >= 0) return headers[idx]
  }
  return null
}

export type CsvColumnMap = {
  date:        string | null
  amount:      string | null
  type:        string | null
  category:    string | null
  description: string | null
}

/** Deteta mapeamento de colunas automaticamente */
export function detectColumnMap(headers: string[]): CsvColumnMap {
  return {
    date:        findCol(headers, ['data', 'date', 'dia']),
    amount:      findCol(headers, ['valor', 'amount', 'montante', 'quantia', 'value']),
    type:        findCol(headers, ['tipo', 'type', 'movimento', 'natureza']),
    category:    findCol(headers, ['categoria', 'category', 'descricao_categoria']),
    description: findCol(headers, ['descricao', 'description', 'descr', 'historico', 'memo', 'obs']),
  }
}

/** Parseia texto CSV completo e retorna headers + rows */
export function parseCsvText(text: string): ParsedCsvResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [], separator: ',' }

  const sep = detectSeparator(lines[0])
  const headers = parseCsvLine(lines[0], sep)
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line, sep)
    const row: CsvRow = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  }).filter(row => Object.values(row).some(v => v.trim()))

  return { headers, rows, separator: sep }
}

export type TransactionCandidate = {
  date:        string
  amount:      number
  type:        'entrada' | 'saida'
  category:    string
  description: string
}

/** Converte rows parseados em TransactionCandidates usando o mapa de colunas */
export function rowsToTransactions(
  rows: CsvRow[],
  map: CsvColumnMap,
): TransactionCandidate[] {
  return rows.map(row => {
    const rawAmount   = map.amount ? (row[map.amount] ?? '0') : '0'
    const amount      = Math.abs(parseAmount(rawAmount))
    const rawType     = map.type ? (row[map.type] ?? '') : ''
    const type        = inferType(rawType, parseAmount(rawAmount))
    const description = map.description ? (row[map.description] ?? '') : ''
    // Sem coluna de categoria (ou célula vazia), tenta inferir pela descrição
    // — mesma heurística do import de PDF e do registo manual.
    const rawCategory = map.category ? (row[map.category] ?? '').trim() : ''
    const category    = rawCategory || suggestCategory(description, type)

    return {
      date:        parseDate(map.date ? (row[map.date] ?? '') : ''),
      amount,
      type,
      category,
      description,
    }
  }).filter(t => t.amount > 0 && t.date)
}
