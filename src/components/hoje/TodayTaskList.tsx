'use client'

import { useState } from 'react'
import type { ProgramTask } from '@/types'
import Icon from '@/components/ui/Icon'

export interface TodayTaskView {
  task: ProgramTask
  title: string
  description: string
  areaLabel: string
}

interface TodayTaskListProps {
  tasks: TodayTaskView[]
  doneCount: number
  totalCount: number
  onAddTask: () => void
  onSelectTask: (task: ProgramTask) => void
  onSkipTask: (task: ProgramTask) => Promise<void>
  onCompleteTask: (task: ProgramTask) => Promise<void>
}

export default function TodayTaskList({
  tasks,
  doneCount,
  totalCount,
  onAddTask,
  onSelectTask,
  onSkipTask,
  onCompleteTask,
}: TodayTaskListProps) {
  // Bloqueia a tarefa enquanto a ação está a ser gravada para evitar duplo toque.
  const [savingId, setSavingId] = useState<string | null>(null)

  async function runAction(task: ProgramTask, action: (task: ProgramTask) => Promise<void>) {
    if (savingId) return
    setSavingId(task.id)
    try {
      await action(task)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section
      id="tarefas-hoje"
      aria-label={`Próxima ação: ${doneCount} de ${totalCount} concluídas`}
      style={{ padding: '18px 20px 0', scrollMarginTop: 16 }}
    >
      <div
        style={{
          display: 'grid',
          gap: 10,
          padding: 16,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(28,32,48,.98), rgba(20,23,32,.98))',
          border: '0.5px solid var(--border)',
          boxShadow: '0 14px 40px rgba(0,0,0,.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, lineHeight: 1.2, color: 'var(--text1)' }}>
            Próxima ação
          </h2>
          <a
            href="/programa"
            style={{
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--teal)',
              textDecoration: 'none',
              fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              touchAction: 'manipulation',
            }}
          >
            Ver todas
          </a>
        </div>

        {tasks.map(({ task, title, description, areaLabel }) => {
          const color = areaColor(task.area)
          return (
            <article
              key={task.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 10,
                padding: '12px 10px',
                borderRadius: 15,
                background: 'rgba(13,15,20,.2)',
                border: `0.5px solid ${task.status === 'completed' ? 'rgba(30,203,180,.3)' : 'var(--border)'}`,
                borderLeft: `3px solid ${color}`,
                opacity: task.status === 'pending' ? 1 : 0.62,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectTask(task)}
                aria-label={`Ver detalhes da tarefa ${title}`}
                style={{
                  width: '100%',
                  minHeight: 44,
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: 0,
                  touchAction: 'manipulation',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: task.status === 'completed' ? 'none' : '2px solid var(--text3)',
                      color: 'var(--teal)',
                      background: task.status === 'completed' ? 'rgba(30,203,180,.12)' : 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {task.status === 'completed' && <Icon name="check" size={16} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 1.22,
                        color: task.status === 'completed' ? 'var(--text3)' : 'var(--text1)',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        marginBottom: 5,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {title}
                    </h3>
                    <div style={{ display: 'flex', gap: 7, fontSize: 13, minWidth: 0, alignItems: 'center' }}>
                      <span style={{ color, fontWeight: 600, flexShrink: 0 }}>{areaLabel}</span>
                      {description && <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>}
                      {description && <span style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{description}</span>}
                    </div>
                  </div>
                </div>
              </button>

              {task.status === 'pending' && (() => {
                const isSaving = savingId === task.id
                const isBusy = savingId !== null
                return (
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexShrink: 0, opacity: isBusy && !isSaving ? 0.4 : 1 }}>
                    <button
                      type="button"
                      aria-label={`Pular tarefa ${title}`}
                      onClick={() => runAction(task, onSkipTask)}
                      disabled={isBusy}
                      style={{ ...compactActionStyle('ghost'), cursor: isBusy ? 'not-allowed' : 'pointer' }}
                    >
                      <span style={compactIconStyle('ghost')}>
                        <Icon name="chevron-right" size={16} color="currentColor" />
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Concluir tarefa ${title}`}
                      onClick={() => runAction(task, onCompleteTask)}
                      disabled={isBusy}
                      aria-busy={isSaving}
                      style={{ ...compactActionStyle('primary'), cursor: isBusy ? 'not-allowed' : 'pointer' }}
                    >
                      <span style={{ ...compactIconStyle('primary'), opacity: isSaving ? 0.6 : 1 }}>
                        <Icon name="check" size={16} color="currentColor" />
                      </span>
                    </button>
                  </div>
                )
              })()}
            </article>
          )
        })}

        {tasks.length === 0 && (
          <div style={{ padding: 18, borderRadius: 16, background: 'rgba(13,15,20,.2)', border: '0.5px solid var(--border)', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            Nenhuma tarefa para hoje.
            <button
              type="button"
              onClick={onAddTask}
              style={{
                minHeight: 44,
                marginTop: 12,
                width: '100%',
                border: 'none',
                borderRadius: 14,
                background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
                color: 'var(--bg0)',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              Criar tarefa
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function areaColor(area: string) {
  if (area === 'corpo') return 'var(--teal)'
  if (area === 'produtividade') return 'var(--accent)'
  if (area === 'emocoes') return 'var(--gold)'
  return 'var(--teal)'
}

// Controlo compacto: ícone de 34px com área de toque de 44px (padding invisível)
// para o texto da tarefa manter pelo menos ~65% da largura útil do card.
function compactActionStyle(kind: 'ghost' | 'primary') {
  return {
    width: 44,
    height: 44,
    border: 'none',
    background: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    touchAction: 'manipulation',
    color: kind === 'primary' ? 'var(--teal)' : 'var(--text3)',
  } as const
}

function compactIconStyle(kind: 'ghost' | 'primary') {
  return {
    width: 34,
    height: 34,
    borderRadius: 11,
    border: kind === 'primary' ? '1.5px solid rgba(30,203,180,.5)' : '0.5px solid rgba(var(--ink-rgb),.18)',
    background: kind === 'primary' ? 'rgba(30,203,180,.12)' : 'rgba(var(--ink-rgb),.03)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}
