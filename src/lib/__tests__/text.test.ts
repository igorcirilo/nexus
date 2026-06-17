import { describe, it, expect } from 'vitest'
import { repairMojibake, repairAndTidy } from '@/lib/text'

describe('lib/text repairMojibake', () => {
  it('repara UTF-8 lido como Latin-1 (round-trip completo)', () => {
    // "Refeição" gravada corrompida -> "RefeiÃ§Ã£o" deve voltar a "Refeição"
    expect(repairMojibake('RefeiÃ§Ã£o')).toBe('Refeição')
    expect(repairMojibake('ManhÃ£ de treino')).toBe('Manhã de treino')
    expect(repairMojibake('ProteÃ­na')).toBe('Proteína')
  })

  it('não toca em texto já correto', () => {
    expect(repairMojibake('Refeição')).toBe('Refeição')
    expect(repairMojibake('Treino de pernas')).toBe('Treino de pernas')
    expect(repairMojibake('')).toBe('')
  })

  it('lida com null/undefined', () => {
    expect(repairMojibake(null)).toBe('')
    expect(repairMojibake(undefined)).toBe('')
  })

  it('repairAndTidy também normaliza espaços', () => {
    expect(repairAndTidy('  Refeição   da   manhÃ£ ')).toBe('Refeição da manhã')
  })
})
