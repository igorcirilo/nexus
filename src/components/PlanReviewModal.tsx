// src/components/PlanReviewModal.tsx
'use client'
import { useState } from 'react'
import type { ParsedTrainingPlan, ParsedDietPlan } from '@/lib/body-plan'

type Mode = 'training' | 'diet'

interface Props {
  mode: Mode
  plan: ParsedTrainingPlan | ParsedDietPlan
  onConfirm: (plan: ParsedTrainingPlan | ParsedDietPlan) => void
  onCancel: () => void
}

export default function PlanReviewModal({ mode, plan, onConfirm, onCancel }: Props) {
  const [editedPlan, setEditedPlan] = useState(plan)
  const [editingItem, setEditingItem] = useState<{ sectionIdx: number; itemIdx: number } | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(sectionIdx: number, itemIdx: number, currentValue: string) {
    setEditingItem({ sectionIdx, itemIdx })
    setEditValue(currentValue)
  }

  function commitEdit() {
    if (!editingItem) return
    const { sectionIdx, itemIdx } = editingItem
    if (mode === 'training') {
      const p = editedPlan as ParsedTrainingPlan
      const sections = p.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          exercises: s.exercises.map((e, ei) =>
            ei !== itemIdx ? e : { ...e, name: editValue }
          ),
        }
      )
      setEditedPlan({ ...p, sections })
    } else {
      const p = editedPlan as ParsedDietPlan
      const meals = p.meals.map((m, mi) =>
        mi !== sectionIdx ? m : {
          ...m,
          items: m.items.map((item, ii) => ii !== itemIdx ? item : editValue),
        }
      )
      setEditedPlan({ ...p, meals })
    }
    setEditingItem(null)
    setEditValue('')
  }

  function deleteItem(sectionIdx: number, itemIdx: number) {
    if (mode === 'training') {
      const p = editedPlan as ParsedTrainingPlan
      const sections = p.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          exercises: s.exercises.filter((_, ei) => ei !== itemIdx),
        }
      )
      setEditedPlan({ ...p, sections })
    } else {
      const p = editedPlan as ParsedDietPlan
      const meals = p.meals.map((m, mi) =>
        mi !== sectionIdx ? m : {
          ...m,
          items: m.items.filter((_, ii) => ii !== itemIdx),
        }
      )
      setEditedPlan({ ...p, meals })
    }
  }

  function addItem(sectionIdx: number) {
    const name = prompt(mode === 'training' ? 'Nome do exercício:' : 'Item:')
    if (!name?.trim()) return
    if (mode === 'training') {
      const p = editedPlan as ParsedTrainingPlan
      const sections = p.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          exercises: [...s.exercises, { id: `manual-${Date.now()}`, name: name.trim() }],
        }
      )
      setEditedPlan({ ...p, sections })
    } else {
      const p = editedPlan as ParsedDietPlan
      const meals = p.meals.map((m, mi) =>
        mi !== sectionIdx ? m : { ...m, items: [...m.items, name.trim()] }
      )
      setEditedPlan({ ...p, meals })
    }
  }

  const sections: Array<{ title: string; items: string[] }> = mode === 'training'
    ? (editedPlan as ParsedTrainingPlan).sections.map(s => ({
        title: s.title,
        items: s.exercises.map(e => e.detail ? `${e.name} — ${e.detail}` : e.name),
      }))
    : (editedPlan as ParsedDietPlan).meals.map(m => ({
        title: m.label,
        items: m.items,
      }))

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)',
      zIndex: 9500, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 16px',
        background: 'var(--bg1)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
            Rever {mode === 'training' ? 'Treino' : 'Dieta'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {sections.length} secções · {totalItems} itens
          </div>
        </div>
        <button onClick={onCancel} style={{
          background: 'var(--bg3)', border: 'none', borderRadius: 8,
          color: 'var(--text2)', fontSize: 18, width: 32, height: 32,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.map((section, si) => (
          <div key={si} style={{
            background: 'var(--bg2)', borderRadius: 14,
            border: '0.5px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '0.5px solid var(--border)',
              fontFamily: 'Syne, sans-serif', fontWeight: 700,
              fontSize: 13, color: 'var(--gold)',
            }}>
              {section.title}
            </div>
            {section.items.map((item, ii) => (
              <div key={ii} style={{
                padding: '9px 14px',
                borderBottom: ii < section.items.length - 1 ? '0.5px solid var(--border)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                {editingItem?.sectionIdx === si && editingItem?.itemIdx === ii ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingItem(null) }}
                    onBlur={commitEdit}
                    style={{
                      flex: 1, background: 'var(--bg3)', border: '0.5px solid var(--gold)',
                      borderRadius: 8, padding: '6px 10px', color: 'var(--text1)',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => startEdit(si, ii, mode === 'training'
                      ? (editedPlan as ParsedTrainingPlan).sections[si].exercises[ii].name
                      : item
                    )}
                    style={{ flex: 1, fontSize: 13, color: 'var(--text1)', cursor: 'text', lineHeight: 1.4 }}
                  >
                    {item}
                  </span>
                )}
                <button
                  onClick={() => deleteItem(si, ii)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text3)',
                    cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => addItem(si)}
              style={{
                width: '100%', background: 'none', border: 'none',
                color: 'var(--text3)', padding: '9px 14px', textAlign: 'left',
                fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
              }}
            >
              + Adicionar item
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 16px',
        background: 'var(--bg1)',
        borderTop: '0.5px solid var(--border)',
        display: 'flex', gap: 10,
      }}>
        <button onClick={onCancel} style={{
          flex: 1, background: 'var(--bg3)', color: 'var(--text2)',
          border: 'none', borderRadius: 12, padding: 13,
          fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          Cancelar
        </button>
        <button onClick={() => onConfirm(editedPlan)} style={{
          flex: 2, background: 'var(--gold)', color: 'var(--bg0)',
          border: 'none', borderRadius: 12, padding: 13,
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          Confirmar e Guardar
        </button>
      </div>
    </div>
  )
}
