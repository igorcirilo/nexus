'use client'
import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import EmptyState from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import { getWeightLogs, upsertWeightLog, deleteWeightLog, type WeightLog } from '@/lib/body'
import { updateProfile } from '@/lib/supabase'

interface Props {
  userId: string
  heightCm: number | null
  onHeightSave: (cm: number) => void
}

type Filter = 30 | 90 | 0

function getLocalDateString(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

export default function WeightLogComponent({ userId, heightCm, onHeightSave }: Props) {
  const toast = useToast()
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [filter, setFilter] = useState<Filter>(30)
  const [weightIn, setWeightIn] = useState('')
  const [dateIn, setDateIn] = useState(getLocalDateString())
  const [saving, setSaving] = useState(false)
  const weightInputRef = useRef<HTMLInputElement | null>(null)
  const [heightVal, setHeightVal] = useState(heightCm ? String(heightCm) : '')
  const [heightEditing, setHeightEditing] = useState(heightCm === null)
  const [heightSaving, setHeightSaving] = useState(false)

  useEffect(() => {
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }, [userId, filter])

  async function handleSave() {
    const kg = parseFloat(weightIn.replace(',', '.'))
    if (isNaN(kg) || kg <= 0 || kg > 500) { toast.error('Peso inválido'); return }
    setSaving(true)
    await upsertWeightLog(userId, dateIn, kg)
    setSaving(false)
    toast.success('Peso registado!')
    setWeightIn('')
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }

  async function handleDelete(id: string) {
    await deleteWeightLog(userId, id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  async function handleHeightSave() {
    const cm = parseFloat(heightVal.replace(',', '.'))
    if (isNaN(cm) || cm < 50 || cm > 250) { toast.error('Altura inválida'); return }
    setHeightSaving(true)
    await updateProfile(userId, { height_cm: cm })
    setHeightSaving(false)
    setHeightEditing(false)
    onHeightSave(cm)
    toast.success('Altura guardada!')
  }

  const chartData = logs.map(l => ({
    date: format(new Date(l.date + 'T12:00:00'), 'd MMM', { locale: pt }),
    kg: Number(l.weight_kg),
  }))

  const latest = logs[logs.length - 1]
  const first = logs[0]
  const delta = latest && first && logs.length > 1
    ? (Number(latest.weight_kg) - Number(first.weight_kg)).toFixed(1)
    : null

  const filterLabels: { value: Filter; label: string }[] = [
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'Tudo' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Altura card */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="170"
              value={heightVal}
              onChange={e => setHeightVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleHeightSave() }}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, padding: '8px 10px', outline: 'none', width: 90 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>cm</span>
            <button onClick={handleHeightSave} disabled={heightSaving || !heightVal} style={{ background: heightVal ? 'var(--gold)' : 'var(--bg3)', color: heightVal ? '#000' : 'var(--text3)', border: 'none', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, padding: '8px 16px', cursor: heightVal ? 'pointer' : 'not-allowed' }}>
              {heightSaving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        )}
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
            placeholder="75.4"
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
          {saving ? 'A guardar…' : 'Registar'}
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

          {delta !== null && (
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 16px',
              flex: 1,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Variação
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: 'Syne, sans-serif',
                color: parseFloat(delta) <= 0 ? 'var(--teal)' : 'var(--gold)',
              }}>
                {parseFloat(delta) > 0 ? '+' : ''}{delta} kg
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

          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
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
                formatter={(v: number) => [`${v} kg`, 'Peso']}
                labelStyle={{ color: 'var(--text3)', fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="kg"
                stroke="var(--teal)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--teal)' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History list */}
      {logs.length === 0 ? (
        <EmptyState
          icon="scale"
          title="Registre seu peso hoje"
          body="Registre seu peso hoje e acompanhe sua tendência ao longo do tempo."
          action={{
            label: 'Inserir peso',
            onClick: () => weightInputRef.current?.focus(),
          }}
        />
      ) : (
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
                  {format(new Date(l.date + 'T12:00:00'), "d 'de' MMM", { locale: pt })}
                </span>
                <button
                  onClick={() => handleDelete(l.id)}
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
                  aria-label="Eliminar registo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
