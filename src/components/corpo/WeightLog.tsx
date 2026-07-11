'use client'
import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { getWeightLogs, upsertWeightLog, deleteWeightLog, type WeightLog } from '@/lib/body'
import { updateProfile } from '@/lib/supabase'
import { todayISO, parseLocalDate } from '@/lib/date'

interface Props {
  userId: string
  heightCm: number | null
  goalWeight: number | null
  onHeightSave: (cm: number) => void
  onGoalSave: (kg: number) => void
}

type Filter = 30 | 90 | 0

export default function WeightLogComponent({ userId, heightCm, goalWeight, onHeightSave, onGoalSave }: Props) {
  const toast = useToast()
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [filter, setFilter] = useState<Filter>(30)
  const [weightIn, setWeightIn] = useState('')
  const [dateIn, setDateIn] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const weightInputRef = useRef<HTMLInputElement | null>(null)
  const [heightVal, setHeightVal] = useState(heightCm ? String(heightCm) : '')
  const [heightEditing, setHeightEditing] = useState(heightCm === null)
  const [heightSaving, setHeightSaving] = useState(false)
  const [goalVal, setGoalVal] = useState(goalWeight ? String(goalWeight) : '')
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }, [userId, filter])

  async function handleSave() {
    const kg = parseFloat(weightIn.replace(',', '.'))
    if (isNaN(kg) || kg <= 0 || kg > 500) { toast.error('Insira um peso entre 1 e 500 kg'); return }
    setSaving(true)
    await upsertWeightLog(userId, dateIn, kg)
    setSaving(false)
    toast.success('Peso registrado!')
    setWeightIn('')
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }

  async function handleDelete(id: string) {
    await deleteWeightLog(userId, id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  async function handleHeightSave() {
    const cm = parseFloat(heightVal.replace(',', '.'))
    if (isNaN(cm) || cm < 50 || cm > 250) { toast.error('Insira uma altura entre 50 e 250 cm'); return }
    setHeightSaving(true)
    await updateProfile(userId, { height_cm: cm })
    setHeightSaving(false)
    setHeightEditing(false)
    onHeightSave(cm)
    toast.success('Altura salva!')
  }

  async function handleGoalSave() {
    const kg = parseFloat(goalVal.replace(',', '.'))
    if (isNaN(kg) || kg <= 0 || kg > 500) { toast.error('Insira uma meta entre 1 e 500 kg'); return }
    setGoalSaving(true)
    await updateProfile(userId, { goal_weight: kg })
    setGoalSaving(false)
    setGoalEditing(false)
    onGoalSave(kg)
    toast.success('Meta salva!')
  }

  // Média móvel de 7 registos: suaviza o ruído diário e mostra a tendência real,
  // reduzindo a ansiedade com flutuações de 0,2–0,5 kg que não significam nada.
  const chartData = logs.map((l, i) => {
    const windowSlice = logs.slice(Math.max(0, i - 6), i + 1)
    const avg = windowSlice.reduce((sum, x) => sum + Number(x.weight_kg), 0) / windowSlice.length
    return {
      date: format(parseLocalDate(l.date), 'd MMM', { locale: pt }),
      kg: Number(l.weight_kg),
      media: Math.round(avg * 10) / 10,
    }
  })

  // Domínio Y com folga generosa: evita que o eixo auto-escale e exagere
  // variações pequenas, transformando ruído em "queda/subida" dramática.
  // A meta entra no domínio para a linha de referência ficar sempre visível.
  const weights = logs.map(l => Number(l.weight_kg))
  const domainValues = goalWeight ? [...weights, Number(goalWeight)] : weights
  const dataMin = domainValues.length ? Math.min(...domainValues) : 0
  const dataMax = domainValues.length ? Math.max(...domainValues) : 0
  const yPad = Math.max(2, dataMax - dataMin)
  const yDomain: [number, number] = [Math.floor(dataMin - yPad), Math.ceil(dataMax + yPad)]

  const latest = logs[logs.length - 1]
  const first = logs[0]
  const deltaNum = latest && first && logs.length > 1
    ? Number(latest.weight_kg) - Number(first.weight_kg)
    : null
  const deltaAbs = deltaNum !== null ? Math.abs(deltaNum).toFixed(1) : null
  // Tom neutro: direção sem juízo de valor (subir não é "mau", descer não é "bom").
  const deltaArrow = deltaNum === null ? '' : Math.abs(deltaNum) < 0.1 ? '→' : deltaNum > 0 ? '↑' : '↓'
  const deltaLabel = deltaNum === null ? '' : Math.abs(deltaNum) < 0.1 ? 'estável' : `${deltaArrow} ${deltaAbs} kg`

  // Distância até a meta — responde "quanto falta?" sem juízo de valor.
  const goalDelta = goalWeight !== null && latest ? Number(latest.weight_kg) - Number(goalWeight) : null
  const goalDeltaLabel =
    goalDelta === null ? '' : Math.abs(goalDelta) < 0.1 ? 'na meta' : `${Math.abs(goalDelta).toFixed(1).replace('.', ',')} kg`

  const filterLabels: { value: Filter; label: string }[] = [
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'Tudo' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Altura + Meta */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 150, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: heightEditing ? 10 : 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Altura
            </div>
            {!heightEditing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Syne, sans-serif' }}>
                  {heightCm} cm
                </span>
                <button onClick={() => setHeightEditing(true)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                  editar
                </button>
              </div>
            )}
          </div>
          {heightEditing && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="170"
                value={heightVal}
                onChange={e => setHeightVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleHeightSave() }}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, padding: '8px 10px', outline: 'none', width: 74 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>cm</span>
              <button onClick={handleHeightSave} disabled={heightSaving || !heightVal} style={{ background: heightVal ? 'var(--gold)' : 'var(--bg3)', color: heightVal ? '#000' : 'var(--text3)', border: 'none', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, padding: '8px 14px', cursor: heightVal ? 'pointer' : 'not-allowed' }}>
                {heightSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          )}
        </div>

        {/* Meta de peso: editável aqui (o Resumo apenas exibe) */}
        <div style={{ flex: 1, minWidth: 150, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: goalEditing ? 10 : 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Meta
            </div>
            {!goalEditing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {goalWeight !== null && (
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Syne, sans-serif' }}>
                    {Number(goalWeight)} kg
                  </span>
                )}
                <button onClick={() => setGoalEditing(true)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                  {goalWeight !== null ? 'editar' : 'definir'}
                </button>
              </div>
            )}
          </div>
          {goalEditing && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="72.0"
                value={goalVal}
                onChange={e => setGoalVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGoalSave() }}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, padding: '8px 10px', outline: 'none', width: 74 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>kg</span>
              <button onClick={handleGoalSave} disabled={goalSaving || !goalVal} style={{ background: goalVal ? 'var(--gold)' : 'var(--bg3)', color: goalVal ? '#000' : 'var(--text3)', border: 'none', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, padding: '8px 14px', cursor: goalVal ? 'pointer' : 'not-allowed' }}>
                {goalSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Data
          </label>
          <input
            type="date"
            value={dateIn}
            onChange={e => setDateIn(e.target.value)}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text1)',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              padding: '8px 10px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Peso (kg)
          </label>
          <input
            ref={weightInputRef}
            type="number"
            inputMode="decimal"
            placeholder={latest ? String(Number(latest.weight_kg)) : '75.4'}
            value={weightIn}
            onChange={e => setWeightIn(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text1)',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              padding: '8px 10px',
              outline: 'none',
              width: 100,
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !weightIn}
          style={{
            background: weightIn ? 'var(--gold)' : 'var(--bg3)',
            color: weightIn ? '#000' : 'var(--text3)',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            padding: '8px 18px',
            cursor: saving || !weightIn ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {saving ? 'Salvando…' : 'Registrar'}
        </button>
      </div>

      {/* Stats row */}
      {latest && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 16px',
            flex: 1,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Último
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Syne, sans-serif' }}>
              {Number(latest.weight_kg)} kg
            </div>
          </div>

          {deltaNum !== null && (
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 16px',
              flex: 1,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Tendência no período
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: 'Syne, sans-serif',
                color: 'var(--text1)',
              }}>
                {deltaLabel}
              </div>
            </div>
          )}

          {goalDelta !== null && (
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 16px',
              flex: 1,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {Math.abs(goalDelta) < 0.1 ? 'Meta' : 'Até a meta'}
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: 'Syne, sans-serif',
                color: 'var(--text1)',
              }}>
                {goalDeltaLabel}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {logs.length > 1 && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '14px 4px 8px',
        }}>
          {/* Filter buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, paddingRight: 12, marginBottom: 8 }}>
            {filterLabels.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  background: filter === value ? 'var(--teal)' : 'var(--bg3)',
                  color: filter === value ? '#000' : 'var(--text2)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 600,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Alternativa textual para leitores de ecrã: o SVG do recharts não é legível. */}
          <div
            role="img"
            aria-label={
              latest
                ? `Gráfico de peso. Atual ${Number(latest.weight_kg)} kg. Tendência no período: ${deltaLabel || 'sem variação'}.`
                : 'Gráfico de evolução do peso'
            }
          >
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              {/* Meta de peso: referência visual constante — responde "quanto falta?" */}
              {goalWeight !== null && (
                <ReferenceLine
                  y={Number(goalWeight)}
                  stroke="var(--gold)"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: 'Meta', position: 'insideTopRight', fill: 'var(--gold)', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
                />
              )}
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13,
                  color: 'var(--text1)',
                }}
                formatter={(v: number, name) => [`${v} kg`, name === 'media' ? 'Média 7d' : 'Peso']}
                labelStyle={{ color: 'var(--text3)', fontSize: 11 }}
              />
              {/* Registos diários: discretos, em segundo plano */}
              <Line
                type="monotone"
                dataKey="kg"
                name="kg"
                stroke="var(--text3)"
                strokeWidth={1}
                dot={{ r: 2, fill: 'var(--text3)' }}
                activeDot={{ r: 4 }}
              />
              {/* Tendência (média móvel): a linha que realmente importa */}
              <Line
                type="monotone"
                dataKey="media"
                name="media"
                stroke="var(--teal)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
          {/* Legenda do gráfico (texto + cor, nunca só cor) */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6, fontSize: 10.5, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ width: 14, height: 2, background: 'var(--teal)', borderRadius: 1, display: 'inline-block' }} />
              Tendência (média 7d)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ width: 6, height: 6, background: 'var(--text3)', borderRadius: '50%', display: 'inline-block' }} />
              Registro diário
            </span>
            {goalWeight !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ width: 14, height: 0, borderTop: '2px dashed var(--gold)', display: 'inline-block' }} />
                Meta
              </span>
            )}
          </div>
        </div>
      )}

      {/* Prévia da tendência: ocupa o lugar do gráfico até haver 2 registos,
          em vez de um estado vazio separado que duplicava o botão de registrar. */}
      {logs.length < 2 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Tendência
          </div>
          <div style={{ position: 'relative', height: 100, borderRadius: 12, border: '1px dashed var(--border)', background: 'linear-gradient(180deg, rgba(30,203,180,.08), transparent 80%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <svg viewBox="0 0 200 90" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} aria-hidden="true">
              <polyline points="0,60 40,55 80,58 120,48 160,44 200,38" fill="none" stroke="var(--teal)" strokeWidth={2} />
            </svg>
            <span style={{ position: 'relative', fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', background: 'var(--bg2)', padding: '4px 10px', borderRadius: 100 }}>
              {logs.length === 0 ? 'Seu gráfico aparece a partir do 2º registro' : 'Mais um registro e o gráfico aparece'}
            </span>
          </div>
        </div>
      )}

      {/* History list */}
      {logs.length > 0 && (
        <div>
          <div style={{
            fontSize: 11,
            color: 'var(--text3)',
            fontFamily: 'DM Sans, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
            marginBottom: 8,
          }}>
            Histórico
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...logs].reverse().map(l => (
              <div
                key={l.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--text1)', fontWeight: 600 }}>
                  {Number(l.weight_kg)} kg
                </span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text3)' }}>
                  {format(parseLocalDate(l.date), "d 'de' MMM", { locale: pt })}
                </span>
                <button
                  onClick={() => setConfirmDeleteId(l.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text3)',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '2px 4px',
                    borderRadius: 4,
                  }}
                  aria-label="Excluir registro"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir registro de peso?"
        body={(() => {
          const log = logs.find(l => l.id === confirmDeleteId)
          return log
            ? `O registro de ${Number(log.weight_kg)} kg em ${format(parseLocalDate(log.date), "d 'de' MMMM", { locale: pt })} será removido. Esta ação não pode ser desfeita.`
            : 'Este registro será removido. Esta ação não pode ser desfeita.'
        })()}
        confirmLabel="Excluir registro"
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
