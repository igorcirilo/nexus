import { describe, it, expect } from 'vitest'
import { suggestCategory } from '@/lib/categorize'

describe('suggestCategory', () => {
  it('sugere categorias de saída por palavras-chave (case-insensitive)', () => {
    expect(suggestCategory('COMPRA CONTINENTE LX', 'saida')).toBe('Alimentação')
    expect(suggestCategory('Uber *trip', 'saida')).toBe('Transporte')
    expect(suggestCategory('NETFLIX.COM', 'saida')).toBe('Assinaturas')
    expect(suggestCategory('Renda julho', 'saida')).toBe('Habitação')
  })

  it('sugere as categorias de aporte para saídas', () => {
    expect(suggestCategory('Aporte ETF mundial', 'saida')).toBe('Investimentos')
    expect(suggestCategory('Trade Republic', 'saida')).toBe('Investimentos')
    expect(suggestCategory('Fundo de emergência julho', 'saida')).toBe('Emergências')
  })

  it('sugere categorias de entrada', () => {
    expect(suggestCategory('Salário junho', 'entrada')).toBe('Salário')
    expect(suggestCategory('Fatura cliente X', 'entrada')).toBe('Freelance')
    expect(suggestCategory('Dividendos ETF', 'entrada')).toBe('Investimento')
  })

  it('cai em Outro sem correspondência', () => {
    expect(suggestCategory('xpto', 'saida')).toBe('Outro')
    expect(suggestCategory('xpto', 'entrada')).toBe('Outro')
  })
})
