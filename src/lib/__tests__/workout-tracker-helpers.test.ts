import { describe, it, expect } from 'vitest'
import {
  sectionWeekday,
  cleanSectionTitle,
  sectionLetter,
  parseExerciseDetail,
  estimateMinutes,
  prettyPlanName,
  nextRotationIdx,
  getScheduleOverride,
  resolveDayAssignment,
} from '@/components/corpo/WorkoutTracker'

describe('sectionWeekday', () => {
  it('reconhece os dias nos títulos importados', () => {
    expect(sectionWeekday('Segunda - A Peito Ombros Tríceps')).toBe(1)
    expect(sectionWeekday('Terça - B Costas Bíceps')).toBe(2)
    expect(sectionWeekday('terca - B Costas')).toBe(2) // sem acento
    expect(sectionWeekday('Quarta - C Inferiores Adaptação')).toBe(3)
    expect(sectionWeekday('Sábado — treino livre')).toBe(6)
    expect(sectionWeekday('Domingo')).toBe(0)
  })

  it('título sem dia → null (cai na rotação)', () => {
    expect(sectionWeekday('Treino A - Peito')).toBeNull()
    expect(sectionWeekday('Upper 1')).toBeNull()
  })
})

describe('cleanSectionTitle', () => {
  it('remove o prefixo de dia e separadores', () => {
    expect(cleanSectionTitle('Terça - B Costas Bíceps')).toBe('B Costas Bíceps')
    expect(cleanSectionTitle('Segunda-feira: A Peito')).toBe('A Peito')
    expect(cleanSectionTitle('QUARTA — C Inferiores')).toBe('C Inferiores')
  })

  it('título sem prefixo fica intacto; só o dia não vira vazio', () => {
    expect(cleanSectionTitle('Treino A - Peito')).toBe('Treino A - Peito')
    expect(cleanSectionTitle('Sexta')).toBe('Sexta')
  })
})

describe('sectionLetter', () => {
  it('extrai a letra da sessão para a fita semanal', () => {
    expect(sectionLetter('B Costas Bíceps')).toBe('B')
    expect(sectionLetter('a peito')).toBe('A')
    expect(sectionLetter('Treino C - Pernas')).toBe('C')
  })

  it('sem padrão de letra → null', () => {
    expect(sectionLetter('Costas e Bíceps')).toBeNull()
    expect(sectionLetter('')).toBeNull()
  })
})

describe('parseExerciseDetail', () => {
  it('lê séries e descanso do formato importado', () => {
    expect(parseExerciseDetail('4 | 8 a 12 | a definir | 90s')).toEqual({ sets: 4, restSec: 90 })
    expect(parseExerciseDetail('3 | 12 a 15 | a definir | 75s')).toEqual({ sets: 3, restSec: 75 })
  })

  it('campos ausentes viram null', () => {
    expect(parseExerciseDetail('8 a 12 repetições')).toEqual({ sets: null, restSec: null })
    expect(parseExerciseDetail(undefined)).toEqual({ sets: null, restSec: null })
  })
})

describe('estimateMinutes', () => {
  it('estima a partir de séries × (execução + descanso), arredondado a 5', () => {
    const ex = (detail: string, i: number) => ({ id: String(i), name: `ex ${i}`, detail })
    // 4 séries × (40+90)s = 520s por exercício; 6 exercícios ≈ 52 min → 50
    const exercises = Array.from({ length: 6 }, (_, i) => ex('4 | 8 a 12 | a definir | 90s', i))
    expect(estimateMinutes(exercises)).toBe(50)
  })

  it('sem nenhum detalhe conhecido → null (não inventa)', () => {
    expect(estimateMinutes([{ id: '1', name: 'x' }])).toBeNull()
  })
})

describe('prettyPlanName', () => {
  it('humaniza o nome do ficheiro', () => {
    expect(prettyPlanName('plano_treino_abc_hipertrofia')).toBe('Plano Treino Abc Hipertrofia')
  })
})

describe('nextRotationIdx', () => {
  it('avança e dá a volta', () => {
    expect(nextRotationIdx(null, 3)).toBe(0)
    expect(nextRotationIdx(0, 3)).toBe(1)
    expect(nextRotationIdx(2, 3)).toBe(0)
  })
})

describe('getScheduleOverride', () => {
  it('lê overrides válidos (sessão e descanso)', () => {
    const plan = { raw_content: { schedule: { '1': 2, '3': null } } }
    expect(getScheduleOverride(plan)).toEqual({ 1: 2, 3: null })
  })

  it('sem schedule ou plano nulo → objeto vazio', () => {
    expect(getScheduleOverride({ raw_content: {} })).toEqual({})
    expect(getScheduleOverride({ raw_content: null })).toEqual({})
    expect(getScheduleOverride(null)).toEqual({})
  })

  it('ignora chaves/valores inválidos sem quebrar as válidas', () => {
    const plan = { raw_content: { schedule: { '1': 0, '9': 2, foo: 1, '2': 1.5, '4': 'x' } } }
    expect(getScheduleOverride(plan)).toEqual({ 1: 0 })
  })
})

describe('resolveDayAssignment', () => {
  const sections = [{ title: 'Segunda - A Peito' }, { title: 'Terça - B Costas' }, { title: 'C Pernas' }]

  it('sem override, casa pelo dia no título', () => {
    expect(resolveDayAssignment(1, sections, {})).toEqual({ kind: 'section', idx: 0, overridden: false })
    expect(resolveDayAssignment(2, sections, {})).toEqual({ kind: 'section', idx: 1, overridden: false })
  })

  it('sem título nem override → unset (cai na rotação)', () => {
    expect(resolveDayAssignment(5, sections, {})).toEqual({ kind: 'unset', overridden: false })
  })

  it('override de sessão vence o título automático', () => {
    // Segunda estava mapeada para A (idx 0); o utilizador trocou para C (idx 2).
    expect(resolveDayAssignment(1, sections, { 1: 2 })).toEqual({ kind: 'section', idx: 2, overridden: true })
  })

  it('override de descanso explícito', () => {
    expect(resolveDayAssignment(1, sections, { 1: null })).toEqual({ kind: 'rest', overridden: true })
  })

  it('override apontando para secção que já não existe → unset', () => {
    expect(resolveDayAssignment(1, sections, { 1: 9 })).toEqual({ kind: 'unset', overridden: false })
  })
})
