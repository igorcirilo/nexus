import { describe, it, expect, beforeEach } from 'vitest'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import { saveDraft, loadDraft, clearDraft, ONBOARDING_QUESTIONS } from '@/lib/onboarding-engine'

describe('onboarding draft', () => {
  beforeEach(() => localStorageMock.clear())

  it('saves and loads draft', () => {
    saveDraft({ b1_corpo: 3, b2_objetivo: 'corpo' })
    expect(loadDraft()).toEqual({ b1_corpo: 3, b2_objetivo: 'corpo' })
  })

  it('returns empty object when no draft', () => {
    expect(loadDraft()).toEqual({})
  })

  it('clears draft', () => {
    saveDraft({ b1_corpo: 3 })
    clearDraft()
    expect(loadDraft()).toEqual({})
  })
})

describe('ONBOARDING_QUESTIONS', () => {
  it('has 17 questions', () => {
    expect(ONBOARDING_QUESTIONS).toHaveLength(17)
  })

  it('all questions have id, block, text, type, weight', () => {
    for (const q of ONBOARDING_QUESTIONS) {
      expect(q.id).toBeTruthy()
      expect(q.block).toBeGreaterThan(0)
      expect(q.text).toBeTruthy()
      expect(q.type).toMatch(/^(scale|single|multiple|ranking)$/)
      expect(typeof q.weight).toBe('number')
    }
  })

  it('scale questions have min and max', () => {
    const scaleQs = ONBOARDING_QUESTIONS.filter(q => q.type === 'scale')
    for (const q of scaleQs) {
      expect(q.min).toBeDefined()
      expect(q.max).toBeDefined()
    }
  })

  it('single and multiple questions have options', () => {
    const choiceQs = ONBOARDING_QUESTIONS.filter(q => q.type === 'single' || q.type === 'multiple')
    for (const q of choiceQs) {
      expect(q.options).toBeDefined()
      expect(q.options!.length).toBeGreaterThan(0)
    }
  })
})
