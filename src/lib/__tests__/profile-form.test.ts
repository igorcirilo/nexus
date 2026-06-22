import { describe, it, expect } from 'vitest'
import { normalizeProfileForm } from '@/lib/profile-form'

describe('lib/profile-form · normalizeProfileForm (P2.7)', () => {
  it('converte strings vazias de campos numéricos em null', () => {
    const out = normalizeProfileForm({ age: '', weight_kg: '', fin_debt_goal: '' })
    expect(out.age).toBeNull()
    expect(out.weight_kg).toBeNull()
    expect(out.fin_debt_goal).toBeNull()
  })

  it('converte strings numéricas em Number', () => {
    const out = normalizeProfileForm({ age: '30', weight_kg: '72.5', water_goal_ml: 2000 })
    expect(out.age).toBe(30)
    expect(out.weight_kg).toBe(72.5)
    expect(out.water_goal_ml).toBe(2000)
  })

  it('valores numéricos inválidos viram null', () => {
    const out = normalizeProfileForm({ age: 'abc', height_cm: 'x' })
    expect(out.age).toBeNull()
    expect(out.height_cm).toBeNull()
  })

  it('preserva campos não numéricos (username, sex)', () => {
    const out = normalizeProfileForm({ username: 'Igor', sex: 'masculino', age: '' })
    expect(out.username).toBe('Igor')
    expect(out.sex).toBe('masculino')
    expect(out.age).toBeNull()
  })

  it('null/undefined em campos numéricos viram null', () => {
    const out = normalizeProfileForm({ goal_weight: null, fin_reserve_goal: undefined })
    expect(out.goal_weight).toBeNull()
    expect(out.fin_reserve_goal).toBeNull()
  })
})
