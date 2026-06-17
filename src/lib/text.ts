/**
 * Reparação de mojibake (texto UTF-8 que foi gravado interpretado como Latin-1,
 * produzindo sequências como "Ã§" em vez de "ç").
 *
 * Antes existiam três cópias divergentes desta lógica: o TextDecoder em
 * src/app/hoje/page.tsx e mapas de regex frágeis em body-plan.ts e DietTracker.
 * Esta é a fonte única — robusta (faz o round-trip completo quando possível) com
 * fallback por mapa para conteúdo misto.
 */

const MOJIBAKE_MARKERS = /Ã|Â|â€|âœ/

// Substituições pontuais para casos em que o round-trip não se aplica
// (string com chars já corretos misturados com mojibake).
const FALLBACK_MAP: [RegExp, string][] = [
  [/Â·/g, '·'], [/â€¦/g, '...'], [/âœ“/g, '✓'],
  [/Ã§/g, 'ç'], [/Ã£/g, 'ã'], [/Ã¡/g, 'á'], [/Ã¢/g, 'â'],
  [/Ã©/g, 'é'], [/Ãª/g, 'ê'], [/Ã­/g, 'í'], [/Ã³/g, 'ó'],
  [/Ã´/g, 'ô'], [/Ãº/g, 'ú'], [/Ãµ/g, 'õ'], [/Ã /g, 'à'],
]

/**
 * Reverte a dupla codificação. Não toca em texto já correto (sem marcadores).
 */
export function repairMojibake(value: string | null | undefined): string {
  if (!value) return value ?? ''
  if (!MOJIBAKE_MARKERS.test(value)) return value

  // Caminho robusto: se todos os code points couberem em Latin-1, reinterpreta
  // os bytes como UTF-8 — reverte a corrupção por completo, sem mapa manual.
  if (Array.from(value).every((ch) => ch.charCodeAt(0) <= 0xff)) {
    try {
      const bytes = Uint8Array.from(Array.from(value), (ch) => ch.charCodeAt(0) & 0xff)
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      if (decoded && !decoded.includes('�')) return decoded
    } catch {
      /* cai no fallback */
    }
  }

  return FALLBACK_MAP.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), value)
}

/** Repara o mojibake e normaliza espaços — para uso em exibição. */
export function repairAndTidy(value: string | null | undefined): string {
  return repairMojibake(value).replace(/\s+/g, ' ').trim()
}
