'use client'

import { useState } from 'react'
import type { TrainingPlan } from '@/types'
import type { ParsedTrainingPlan } from '@/lib/body-plan'

interface Props {
  plans: TrainingPlan[]
  onSelect: (planId: string, sectionIdx: number, sectionTitle: string) => void
  onClose: () => void
  onImport: () => void
}

function getParsed(plan: TrainingPlan): ParsedTrainingPlan | null {
  const raw = plan.raw_content as { parsedPlan?: ParsedTrainingPlan } | null
  return raw?.parsedPlan ?? null
}

export default function PlanSelector({ plans, onSelect, onClose, onImport }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(
    plans.length === 1 ? plans[0].id : null
  )

  function togglePlan(planId: string) {
    setExpandedId(prev => (prev === planId ? null : planId))
  }

  function handleSelect(planId: string, sectionIdx: number, sectionTitle: string) {
    onSelect(planId, sectionIdx, sectionTitle)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 200,
        }}
      />

      {/* Bottom sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          background: 'var(--bg1)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text1)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Que treino fazes hoje?
            </p>
            <p
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 13,
                color: 'var(--text3)',
                margin: '4px 0 0',
              }}
            >
              Escolhe o plano e a secção
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text2)',
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
              flexShrink: 0,
              marginTop: -2,
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: '1 1 0',
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 16px 24px',
          }}
        >
          {plans.length === 0 ? (
            /* Empty state */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                padding: '40px 16px',
              }}
            >
              <p
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 15,
                  color: 'var(--text2)',
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                Ainda não tens nenhum plano de treino importado.
              </p>
              <button
                onClick={onImport}
                style={{
                  background: 'var(--teal)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 24px',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Importar plano
              </button>
            </div>
          ) : (
            <>
              {/* Plan cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plans.map(plan => {
                  const parsed = getParsed(plan)
                  const sections = parsed?.sections ?? []
                  const isExpanded = expandedId === plan.id

                  return (
                    <div
                      key={plan.id}
                      style={{
                        background: 'var(--bg2)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Plan header (toggle) */}
                      <button
                        onClick={() => togglePlan(plan.id)}
                        style={{
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          textAlign: 'left',
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontFamily: 'Syne, sans-serif',
                              fontSize: 15,
                              fontWeight: 700,
                              color: 'var(--text1)',
                              margin: 0,
                              lineHeight: 1.3,
                            }}
                          >
                            {plan.title}
                          </p>
                          <p
                            style={{
                              fontFamily: 'DM Sans, sans-serif',
                              fontSize: 12,
                              color: 'var(--text3)',
                              margin: '3px 0 0',
                            }}
                          >
                            {sections.length} secção{sections.length !== 1 ? 'ões' : ''}
                          </p>
                        </div>
                        <span
                          style={{
                            color: 'var(--text2)',
                            fontSize: 18,
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            flexShrink: 0,
                          }}
                        >
                          ▾
                        </span>
                      </button>

                      {/* Sections list */}
                      {isExpanded && (
                        <div
                          style={{
                            borderTop: '1px solid var(--border)',
                          }}
                        >
                          {sections.length === 0 ? (
                            <p
                              style={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: 13,
                                color: 'var(--text3)',
                                margin: 0,
                                padding: '12px 16px',
                              }}
                            >
                              Nenhuma secção encontrada neste plano.
                            </p>
                          ) : (
                            sections.map((section, idx) => (
                              <button
                                key={section.id}
                                onClick={() => handleSelect(plan.id, idx, section.title)}
                                style={{
                                  width: '100%',
                                  background: 'none',
                                  border: 'none',
                                  borderBottom:
                                    idx < sections.length - 1
                                      ? '1px solid var(--border)'
                                      : 'none',
                                  cursor: 'pointer',
                                  padding: '12px 16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  textAlign: 'left',
                                }}
                              >
                                <div>
                                  <p
                                    style={{
                                      fontFamily: 'DM Sans, sans-serif',
                                      fontSize: 14,
                                      fontWeight: 600,
                                      color: 'var(--text1)',
                                      margin: 0,
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {section.title}
                                  </p>
                                  <p
                                    style={{
                                      fontFamily: 'DM Sans, sans-serif',
                                      fontSize: 12,
                                      color: 'var(--text3)',
                                      margin: '2px 0 0',
                                    }}
                                  >
                                    {section.exercises.length} exercício
                                    {section.exercises.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                <span
                                  style={{
                                    color: 'var(--teal)',
                                    fontSize: 18,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  →
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Import another plan button */}
              <button
                onClick={onImport}
                style={{
                  marginTop: 16,
                  width: '100%',
                  background: 'none',
                  border: '1.5px dashed var(--border)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--text2)',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 14,
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: 'var(--teal)',
                  }}
                >
                  +
                </span>
                Importar outro plano
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
