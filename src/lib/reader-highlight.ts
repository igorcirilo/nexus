/**
 * Pintura dos destaques guardados sobre o texto da página do leitor.
 *
 * Os excertos são guardados como texto solto (escritos ou colados pelo
 * utilizador), não como posições no documento — por isso a ligação ao texto da
 * página faz-se por procura. A comparação ignora maiúsculas e normaliza os
 * espaços, para que um excerto colado de um parágrafo com quebras de linha
 * continue a encontrar o seu lugar.
 */

/** Um destaque a pintar: o texto guardado e a cor com que foi guardado. */
export type HighlightMark = {
  excerpt: string
  color: string
}

/** Pedaço de texto a renderizar; `color` presente significa "marcado". */
export type TextSegment = {
  text: string
  color?: string
}

type Range = { start: number; end: number; color: string }

/**
 * Versão do texto com espaços colapsados e em minúsculas, mais o mapa de cada
 * posição normalizada para a sua posição no texto original.
 */
function normalize(text: string): { value: string; map: number[] } {
  let value = ''
  const map: number[] = []
  let pendingSpace = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (/\s/.test(char)) {
      // Corridas de espaços/quebras valem por um único espaço.
      if (value.length > 0) pendingSpace = true
      continue
    }
    if (pendingSpace) {
      value += ' '
      map.push(i)
      pendingSpace = false
    }
    value += char.toLowerCase()
    map.push(i)
  }

  return { value, map }
}

/**
 * Divide `text` em segmentos, marcando os que correspondem a algum excerto.
 *
 * De cada excerto pinta-se apenas a primeira ocorrência: repetir a marca em
 * todas as ocorrências de uma frase comum pintaria trechos que o utilizador
 * nunca destacou. Excertos sobrepostos fundem-se, ficando com a cor do
 * primeiro da lista.
 */
export function paintHighlights(text: string, marks: HighlightMark[]): TextSegment[] {
  if (!text) return []

  const haystack = normalize(text)
  const ranges: Range[] = []

  for (const mark of marks) {
    const needle = normalize(mark.excerpt).value.trim()
    if (needle.length < 2) continue

    const at = haystack.value.indexOf(needle)
    if (at === -1) continue

    ranges.push({
      start: haystack.map[at],
      end: haystack.map[at + needle.length - 1] + 1,
      color: mark.color,
    })
  }

  if (ranges.length === 0) return [{ text }]

  ranges.sort((a, b) => a.start - b.start)

  const merged: Range[] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }

  const segments: TextSegment[] = []
  let cursor = 0
  for (const range of merged) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start) })
    segments.push({ text: text.slice(range.start, range.end), color: range.color })
    cursor = range.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })

  return segments
}

/** `#RRGGBB` (ou `#RGB`) em `rgba(...)` com a opacidade pedida. */
export function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return hex

  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
