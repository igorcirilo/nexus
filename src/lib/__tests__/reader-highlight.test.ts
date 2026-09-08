import { describe, it, expect } from 'vitest'
import {
  paintHighlights,
  withAlpha,
  normalizeHighlightColor,
  DEFAULT_HIGHLIGHT_COLOR,
} from '@/lib/reader-highlight'

const GOLD = '#E8A838'

describe('paintHighlights', () => {
  it('devolve o texto inteiro quando não há destaques', () => {
    expect(paintHighlights('Um texto qualquer.', [])).toEqual([{ text: 'Um texto qualquer.' }])
  })

  it('parte o texto em antes, marcado e depois', () => {
    const segments = paintHighlights('Antes do meio e depois.', [{ excerpt: 'do meio', color: GOLD }])
    expect(segments).toEqual([
      { text: 'Antes ' },
      { text: 'do meio', color: GOLD },
      { text: ' e depois.' },
    ])
  })

  it('ignora maiúsculas ao procurar o excerto', () => {
    const segments = paintHighlights('O Hábito vence.', [{ excerpt: 'hábito', color: GOLD }])
    expect(segments[1]).toEqual({ text: 'Hábito', color: GOLD })
  })

  it('encontra um excerto que na página está partido por quebras de linha', () => {
    const text = 'a disciplina\n   vence  o talento'
    const segments = paintHighlights(text, [{ excerpt: 'disciplina vence o talento', color: GOLD }])
    expect(segments).toEqual([
      { text: 'a ' },
      { text: 'disciplina\n   vence  o talento', color: GOLD },
    ])
    // O texto original é preservado tal e qual, só repartido.
    expect(segments.map(s => s.text).join('')).toBe(text)
  })

  it('pinta apenas a primeira ocorrência de cada excerto', () => {
    const segments = paintHighlights('foco e mais foco', [{ excerpt: 'foco', color: GOLD }])
    expect(segments).toEqual([
      { text: 'foco', color: GOLD },
      { text: ' e mais foco' },
    ])
  })

  it('funde excertos sobrepostos, ficando com a cor do primeiro', () => {
    const segments = paintHighlights('um dois três quatro', [
      { excerpt: 'um dois três', color: GOLD },
      { excerpt: 'dois três quatro', color: '#4ED8A0' },
    ])
    expect(segments).toEqual([{ text: 'um dois três quatro', color: GOLD }])
  })

  it('mantém destaques distintos separados', () => {
    const segments = paintHighlights('um dois três quatro', [
      { excerpt: 'um', color: GOLD },
      { excerpt: 'quatro', color: '#4ED8A0' },
    ])
    expect(segments).toEqual([
      { text: 'um', color: GOLD },
      { text: ' dois três ' },
      { text: 'quatro', color: '#4ED8A0' },
    ])
  })

  it('ignora excertos que não existem na página', () => {
    const segments = paintHighlights('um texto', [{ excerpt: 'outra coisa', color: GOLD }])
    expect(segments).toEqual([{ text: 'um texto' }])
  })

  it('ignora excertos vazios ou curtos de mais para ancorar', () => {
    expect(paintHighlights('um texto', [{ excerpt: '   ', color: GOLD }])).toEqual([{ text: 'um texto' }])
    expect(paintHighlights('um texto', [{ excerpt: 'u', color: GOLD }])).toEqual([{ text: 'um texto' }])
  })

  it('devolve vazio para uma página sem texto', () => {
    expect(paintHighlights('', [{ excerpt: 'seja o que for', color: GOLD }])).toEqual([])
  })
})

describe('withAlpha', () => {
  it('converte hex de 6 dígitos', () => {
    expect(withAlpha('#E8A838', 0.42)).toBe('rgba(232, 168, 56, 0.42)')
  })

  it('converte hex de 3 dígitos', () => {
    expect(withAlpha('#FC0', 0.5)).toBe('rgba(255, 204, 0, 0.5)')
  })

  it('devolve o valor original quando não é hex', () => {
    expect(withAlpha('gold', 0.4)).toBe('gold')
  })
})

describe('normalizeHighlightColor', () => {
  it('mantém o dourado como cor dos destaques', () => {
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe('#E8A838')
  })

  it('aceita hex de 6 e de 3 dígitos', () => {
    expect(normalizeHighlightColor('#5BC88A')).toBe('#5BC88A')
    expect(normalizeHighlightColor('#fc0')).toBe('#fc0')
  })

  it('recua para o dourado em registos vazios ou inválidos', () => {
    expect(normalizeHighlightColor('')).toBe(DEFAULT_HIGHLIGHT_COLOR)
    expect(normalizeHighlightColor(null)).toBe(DEFAULT_HIGHLIGHT_COLOR)
    expect(normalizeHighlightColor(undefined)).toBe(DEFAULT_HIGHLIGHT_COLOR)
    expect(normalizeHighlightColor('vermelho')).toBe(DEFAULT_HIGHLIGHT_COLOR)
    expect(normalizeHighlightColor('#12345')).toBe(DEFAULT_HIGHLIGHT_COLOR)
  })

  it('tolera espaços à volta', () => {
    expect(normalizeHighlightColor('  #4FA8E8 ')).toBe('#4FA8E8')
  })
})
