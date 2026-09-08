/**
 * Decisão de "virar página" no leitor a partir de um gesto de toque.
 *
 * O problema que isto resolve: selecionar texto para copiar é um arrasto
 * horizontal — exatamente a forma de um swipe. Distinguem-se pelo resto do
 * gesto: a seleção começa com long-press (é lenta), o swipe é rápido; e a
 * seleção deixa texto selecionado no fim, o swipe não.
 */

/**
 * Percurso mínimo no eixo X, em fração da largura do ecrã: o mesmo gesto tem de
 * "custar" o mesmo num telemóvel estreito e num largo.
 */
export const SWIPE_THRESHOLD_RATIO = 0.18
/** Limites do percurso mínimo (px), para ecrãs muito estreitos ou muito largos. */
export const SWIPE_THRESHOLD_MIN = 64
export const SWIPE_THRESHOLD_MAX = 160
/** |dy| máximo tolerado, em fração de |dx| — acima disto é scroll diagonal. */
export const SWIPE_MAX_OFF_AXIS = 0.6
/** Duração máxima do gesto; acima disto é arrasto deliberado, não swipe. */
export const SWIPE_MAX_MS = 600

/** Estado do toque no início do gesto. */
export type TouchGesture = {
  x: number
  y: number
  time: number
  /** Texto selecionado quando o gesto começou. */
  selection: string
  /** Falso para multitoque ou gestos iniciados em controlos. */
  valid: boolean
}

/** Estado do toque no fim do gesto. */
export type TouchGestureEnd = {
  x: number
  y: number
  time: number
  selection: string
  /** Largura do ecrã, que define o percurso mínimo exigido. */
  viewportWidth: number
}

/** Percurso mínimo (px) exigido a um swipe, dada a largura do ecrã. */
export function swipeThreshold(viewportWidth: number): number {
  const raw = viewportWidth * SWIPE_THRESHOLD_RATIO
  return Math.min(SWIPE_THRESHOLD_MAX, Math.max(SWIPE_THRESHOLD_MIN, raw))
}

export type SwipeDecision = 'next' | 'prev' | null

/**
 * Devolve para que lado virar a página, ou null quando o gesto não é um swipe.
 *
 * Uma seleção criada ou alterada durante o gesto anula-o — era uma seleção.
 * Uma seleção que já existia antes não bloqueia: nesse caso o swipe vale e cabe
 * a quem chama descartar a seleção, como o browser faz num toque qualquer.
 */
export function decideSwipe(start: TouchGesture, end: TouchGestureEnd): SwipeDecision {
  if (!start.valid) return null

  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) < swipeThreshold(end.viewportWidth)) return null
  if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_OFF_AXIS) return null
  if (end.time - start.time > SWIPE_MAX_MS) return null
  if (end.selection && end.selection !== start.selection) return null

  return dx < 0 ? 'next' : 'prev'
}
