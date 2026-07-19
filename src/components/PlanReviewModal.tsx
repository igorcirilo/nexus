'use client'
import { useRef, useState } from 'react'
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
  const [addingSection, setAddingSection] = useState<number | null>(null)
  const [addValue, setAddValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  function startEdit(sectionIdx: number, itemIdx: number, currentValue: string) {
    setAddingSection(null)
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
          exercises: s.exercises.map((e, ei) => ei !== itemIdx ? e : { ...e, name: editValue }),
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

  function startAddItem(sectionIdx: number) {
    setEditingItem(null)
    setAddValue('')
    setAddingSection(sectionIdx)
    setTimeout(() => addInputRef.current?.focus(), 50)
  }

  function commitAdd(sectionIdx: number) {
    const name = addValue.trim()
    if (!name) { setAddingSection(null); return }
    if (mode === 'training') {
      const p = editedPlan as ParsedTrainingPlan
      const sections = p.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          exercises: [...s.exercises, { id: `manual-${Date.now()}`, name }],
        }
      )
      setEditedPlan({ ...p, sections })
    } else {
      const p = editedPlan as ParsedDietPlan
      const meals = p.meals.map((m, mi) =>
        mi !== sectionIdx ? m : { ...m, items: [...m.items, name] }
      )
      setEditedPlan({ ...p, meals })
    }
    setAddingSection(null)
    setAddValue('')
  }

  const sections: Array<{ title: string; items: string[] }> = mode === 'training'
    ? (editedPlan as ParsedTrainingPlan).sections.map(s => ({
        title: s.title,
        items: s.exercises.map(e => e.detail ? `${e.name} - ${e.detail}` : e.name),
      }))
    : (editedPlan as ParsedDietPlan).meals.map(m => ({
        title: m.label,
        items: m.items,
      }))

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
      background: 'rgba(0,0,0,.8)',
      zIndex: 9500,
      padding: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 16,
        left: 16,
        width: '100%',
        maxWidth: 1360,
        margin: '0 auto',
        minHeight: 0,
        background: 'var(--bg1)',
        border: '0.5px solid var(--border)',
        borderRadius: 20,
        boxShadow: '0 20px 80px rgba(0,0,0,.35)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}>
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          padding: '20px 20px 16px',
          background: 'var(--bg1)',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
              Rever {mode === 'training' ? 'Treino' : 'Dieta'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {sections.length} secoes | {totalItems} itens
            </div>
          </div>
          <button onClick={onCancel} style={{
            background: 'var(--bg3)', border: 'none', borderRadius: 8,
            color: 'var(--text2)', fontSize: 18, width: 32, height: 32,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>x</button>
        </div>

        <div style={{ padding: '12px 16px 96px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((section, si) => (
            <div key={si} style={{
              background: 'var(--bg2)', borderRadius: 14,
              border: '0.5px solid var(--border)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '0.5px solid var(--border)',
                fontFamily: 'Inter, sans-serif', fontWeight: 700,
                fontSize: 13, color: 'var(--gold-ink)',
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
                    x
                  </button>
                </div>
              ))}

              {addingSection === si ? (
                <div style={{ padding: '8px 14px', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 8 }}>
                  <input
                    ref={addInputRef}
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitAdd(si); if (e.key === 'Escape') setAddingSection(null) }}
                    onBlur={() => commitAdd(si)}
                    placeholder={mode === 'training' ? 'Nome do exercicio...' : 'Item...'}
                    style={{
                      flex: 1, background: 'var(--bg3)', border: '0.5px solid var(--gold)',
                      borderRadius: 8, padding: '7px 10px', color: 'var(--text1)',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => startAddItem(si)}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    color: 'var(--text3)', padding: '9px 14px', textAlign: 'left',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  + Adicionar item
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          padding: '14px 16px',
          background: 'var(--bg1)',
          borderTop: '0.5px solid var(--border)',
          display: 'flex', gap: 10,
        }}>
          <button onClick={onCancel} style={{
            flex: 1, background: 'var(--bg3)', color: 'var(--text2)',
            border: 'none', borderRadius: 12, padding: 13,
            fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(editedPlan)} style={{
            flex: 2, background: 'var(--gold)', color: 'var(--on-bright)',
            border: 'none', borderRadius: 12, padding: 13,
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Confirmar e Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
