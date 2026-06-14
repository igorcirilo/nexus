'use client'
// src/app/progresso/page.tsx — hub de progresso + dashboard detalhado
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import Nav from '@/components/Nav'
import ProgressoHub from '@/components/progresso/ProgressoHub'
import { supabase, getProfile, getUserBadges, getWeeklyStats, getRitmo } from '@/lib/supabase'
import { AREA_META } from '@/types'
import { format, subDays } from 'date-fns'
import type { Profile, UserBadge } from '@/types'

type AppTab  = 'resumo' | 'dashboard'
type HeatVal = 'none' | 'partial' | 'full'

const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

type AreaProgress = {
  key:string; label:string; icon:string; color:string
  pct:number; done:number; total:number
}

export default function ProgressoPage() {
  const [tab,         setTab]         = useState<AppTab>('resumo')
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [badges,      setBadges]      = useState<UserBadge[]>([])
  const [areas,       setAreas]       = useState<AreaProgress[]>([])
  const [loading,     setLoading]     = useState(true)

  const [ritmo,   setRitmo]   = useState(0)
  const [xpData,  setXpData]  = useState<{day:string;xp:number;hab:number;ci:number}[]>([])
  const [esData,  setEsData]  = useState<{day:string;energia:number|null;sono:number|null}[]>([])
  const [heatmap, setHeatmap] = useState<HeatVal[]>([])
  const [stats,   setStats]   = useState({
    consistency:0, activityWeek:0, sleep:0, energy:0,
    prevConsistency:0, activityTrend:0, thisDone:0, thisTotal:0, checkinsToday:0,
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }

      const since7  = format(subDays(new Date(), 6),  'yyyy-MM-dd')
      const since14 = format(subDays(new Date(), 13), 'yyyy-MM-dd')
      const since28 = format(subDays(new Date(), 27), 'yyyy-MM-dd')
      const today   = format(new Date(), 'yyyy-MM-dd')

      const [prof, ub, weekly, ritmoNow,
        { data: logs14 }, { data: logs28 }, { data: ci14 }, { data: habits }
      ] = await Promise.all([
        getProfile(user.id),
        getUserBadges(user.id),
        getWeeklyStats(user.id),
        getRitmo(user.id),
        supabase.from('habit_logs').select('date,completed,habit_id')
          .eq('user_id',user.id).gte('date',since14).lt('date',since7),
        supabase.from('habit_logs').select('date,completed')
          .eq('user_id',user.id).gte('date',since28),
        supabase.from('checkins').select('date,phase')
          .eq('user_id',user.id).gte('date',since14).lt('date',since7),
        supabase.from('habits').select('id,area')
          .eq('user_id',user.id).eq('active',true),
      ])

      setProfile(prof)
      setBadges(ub as UserBadge[])
      setRitmo(ritmoNow)

      // ── Cada conclusão (hábito/check-in) vale 1 ponto de atividade ───────
      type HabitRow = { id:string; area:string }

      // ── Area progress (últimos 7 dias vs total activo) ───────────────────
      type LogRow = { habit_id:string; completed:boolean; date:string }
      const habitsByArea: Record<string,string[]> = {}
      ;(habits ?? [] as HabitRow[]).forEach((h:HabitRow) => {
        if (!habitsByArea[h.area]) habitsByArea[h.area] = []
        habitsByArea[h.area].push(h.id)
      })
      const areaList: AreaProgress[] = Object.entries(AREA_META).map(([key, meta]) => {
        const ids   = habitsByArea[key] ?? []
        const total = ids.length * 30
        const done  = (weekly.logs as LogRow[])
          .filter((l:LogRow) => ids.includes(l.habit_id) && l.completed).length
        return {
          key, label:meta.label, icon:meta.icon, color:meta.color,
          pct: total > 0 ? Math.round(done/total*100) : 0, done, total,
        }
      })
      setAreas(areaList)

      // ── Atividade por dia (conclusões: hábitos + check-ins) ─────────────
      type LogRow7 = { date:string; completed:boolean; habit_id:string }
      type CIRow   = {
        date:string; phase?:string|null; energy?:number|null
        sleep_hours?:number|null; mood?:number|null
      }
      const xpByDay = Array.from({length:7},(_,i) => {
        const d     = subDays(new Date(), 6-i)
        const day   = format(d,'yyyy-MM-dd')
        const habXP = (weekly.logs as LogRow7[])
          .filter(l => l.date===day && l.completed).length
        const ciXP  = (weekly.checkins as CIRow[])
          .filter(c => c.date===day).length
        return { day:DAYS_PT[d.getDay()], xp:habXP+ciXP, hab:habXP, ci:ciXP }
      })
      setXpData(xpByDay)

      // ── Energia + sono ───────────────────────────────────────────────────
      const esD = Array.from({length:7},(_,i) => {
        const d   = subDays(new Date(), 6-i)
        const day = format(d,'yyyy-MM-dd')
        const ci  = (weekly.checkins as CIRow[]).find(c => c.date===day)
        return { day:DAYS_PT[d.getDay()], energia:ci?.energy??null, sono:ci?.sleep_hours??null }
      })
      setEsData(esD)

      // ── Heatmap — verde=completo · roxo=parcial · escuro=sem registo ─────
      type Log28 = { date:string; completed:boolean }
      const totalHabits = (habits ?? []).length
      const hm: HeatVal[] = Array.from({length:28},(_,i) => {
        const d    = subDays(new Date(), 27-i)
        const day  = format(d,'yyyy-MM-dd')
        const done = (logs28 as Log28[] ?? [])
          .filter(l => l.date===day && l.completed).length
        if (done === 0) return 'none'
        if (totalHabits > 0 && done >= totalHabits) return 'full'
        return 'partial'
      })
      setHeatmap(hm)

      // ── Stats resumo ─────────────────────────────────────────────────────
      type LogC = { completed:boolean }

      const thisDone  = (weekly.logs as LogC[]).filter(l => l.completed).length
      const thisTotal = (weekly.logs as LogC[]).length
      const prevDone  = (logs14 as LogC[] ?? []).filter(l => l.completed).length
      const prevTotal = (logs14 as LogC[] ?? []).length
      const consistency     = thisTotal > 0 ? Math.round(thisDone/thisTotal*100) : 0
      const prevConsistency = prevTotal > 0 ? Math.round(prevDone/prevTotal*100) : 0
      const activityWeek  = xpByDay.reduce((a,d) => a+d.xp, 0)
      const prevActivity  = prevDone + ((ci14 as unknown[] ?? []).length)
      const ciAll = (weekly.checkins as CIRow[]).filter(c => c.energy)
      const slAll = (weekly.checkins as CIRow[]).filter(c => c.sleep_hours)
      const avgE  = ciAll.length > 0
        ? Math.round(ciAll.reduce((a:number,c:CIRow) => a+(c.energy??0),0)/ciAll.length*10)/10 : 0
      const avgS  = slAll.length > 0
        ? Math.round(slAll.reduce((a:number,c:CIRow) => a+(c.sleep_hours??0),0)/slAll.length*10)/10 : 0
      const checkinsToday = (weekly.checkins as CIRow[]).filter(c => c.date===today).length

      setStats({ consistency, prevConsistency, activityWeek, activityTrend:activityWeek-prevActivity,
        sleep:avgS, energy:avgE, thisDone, thisTotal, checkinsToday })
      setLoading(false)
      setTimeout(() => setReady(true), 60)
    })
  }, [])

  const earned  = new Set(badges.map(b => b.badge_key))
  const hmColor: Record<HeatVal,string> = {
    none: '#1C2030', partial: '#534AB7', full: '#1ECBB4',
  }
  const TT: React.CSSProperties = {
    background:'#1C2030', border:'0.5px solid rgba(255,255,255,.1)',
    borderRadius:10, color:'#F0EDE8', fontSize:12,
  }

  if (loading || !profile) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>
      <div style={{fontFamily:'Syne, sans-serif',color:'var(--text3)'}}>a carregar…</div>
    </div>
  )

  if (tab === 'resumo') {
    return (
      <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: '#07070F' }}>
        <ProgressoHub
          profile={profile}
          ritmo={ritmo}
          areas={areas}
          badges={badges}
          earnedKeys={earned}
          consistency={stats.consistency}
          weekData={xpData.map(d => ({ day: d.day, value: d.xp }))}
          onDashboard={() => setTab('dashboard')}
        />
        <Nav />
      </main>
    )
  }

  return (
    <main style={{paddingBottom:'calc(150px + env(safe-area-inset-bottom))',minHeight:'100dvh',background:'#07070F',fontFamily:'Inter, sans-serif'}}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{padding:'28px 20px 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <button onClick={()=>setTab('resumo')} style={{
            background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',
            display:'flex',alignItems:'center',gap:4,fontSize:13,padding:'4px 0',
            fontFamily:'Inter, sans-serif',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Progresso
          </button>
        </div>
        <h1 style={{fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:24,marginBottom:4,lineHeight:1.2,color:'#fff'}}>
          Dashboard
        </h1>
        <p style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:4,lineHeight:1.4}}>
          Evolução semanal, consistência e comparação contigo mesmo.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB DASHBOARD
      ══════════════════════════════════════════════════════════════════ */}
      {tab==='dashboard' && (
        <>
          {/* Header check-ins */}
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:'16px 20px 0'}}>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Esta semana</div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:18,color:'#F5C842',lineHeight:1}}>
                {stats.checkinsToday}/3
              </div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>check-ins hoje</div>
            </div>
          </div>

          {/* Métricas 2×2 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'10px 20px 0'}}>
            {[
              {
                l:'Consistência', v:`${stats.consistency}%`, c:'#00C896',
                trend:`${stats.consistency>=stats.prevConsistency?'↑':'↓'} vs semana passada`,
                up:stats.consistency>=stats.prevConsistency,
              },
              {
                l:'Ritmo atual', v:`${ritmo}`, c:'#F5C842',
                trend:`${stats.activityTrend>=0?'↑ +':'↓ '}${Math.abs(stats.activityTrend)} conclusões vs ant.`,
                up:stats.activityTrend>=0,
              },
              {
                l:'Energia média',
                v:stats.energy>0?`${stats.energy}/10`:'—', c:'#9D5CF5',
                sub:stats.energy>=7?'Boa semana ⚡':stats.energy>0?'Recupera o sono':'Sem dados',
              },
              {
                l:'Sono médio',
                v:stats.sleep>0?`${stats.sleep}h`:'—', c:'#fff',
                sub:stats.sleep>=7?'Dentro do ideal':stats.sleep>0?'Abaixo do ideal':'Sem dados',
              },
            ].map(({l,v,c,trend,sub,up})=>(
              <div key={l} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:4}}>{l}</div>
                <div style={{fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:22,color:c,marginBottom:3,lineHeight:1}}>
                  {v}
                </div>
                {trend && <div style={{fontSize:11,color:up?'#00C896':'#E24B4A'}}>{trend}</div>}
                {sub   && <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Mentor */}
          <div style={{
            margin:'10px 20px 0',padding:'14px 16px',borderRadius:14,
            background:'rgba(255,255,255,0.04)',border:'1px solid rgba(0,200,150,0.15)',
            fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.6,
          }}>
            <span style={{color:'#00C896',fontWeight:500}}>Mentor: </span>
            {stats.consistency>=80
              ? `Consistência de ${stats.consistency}% — execução real.`
              : `${stats.consistency}% esta semana. Foca num hábito de cada vez.`}
            {' '}<span style={{color:'#F5C842'}}>
              Próxima conquista:{' '}
              {profile.streak_current<7
                ? `streak de 7 dias — faltam ${7-profile.streak_current}`
                : profile.streak_current<21
                  ? `streak de 21 dias — faltam ${21-profile.streak_current}`
                  : `streak de 100 dias — faltam ${100-profile.streak_current}`
              } dias.
            </span>
          </div>

          <div style={{padding:'12px 20px 0'}}>

            {/* Atividade diária */}
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'16px',marginBottom:12}}>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:8}}>Atividade diária — hábitos + check-ins</div>
              <div style={{display:'flex',gap:14,marginBottom:10}}>
                {([['#534AB7','Hábitos'],['#E8A838','Check-ins']] as [string,string][]).map(([c,l])=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'rgba(255,255,255,0.4)'}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
                  </div>
                ))}
              </div>
              <div style={{height:150,overflow:'hidden',position:'relative'}}>
                {ready && (
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={xpData} barGap={2} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="day" tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/>
                      <Tooltip contentStyle={TT}
                        formatter={(v:number,n:string)=>[v,n==='hab'?'Hábitos':'Check-ins']}/>
                      <Bar dataKey="hab" name="hab" stackId="a" fill="#534AB7" radius={[0,0,0,0]}/>
                      <Bar dataKey="ci"  name="ci"  stackId="a" fill="#E8A838" radius={[5,5,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Energia + Sono */}
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'16px',marginBottom:12}}>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:8}}>Energia e Sono — 7 dias</div>
              <div style={{display:'flex',gap:14,marginBottom:10}}>
                {([['#00C896','Energia'],['#9D5CF5','Sono (h)']] as [string,string][]).map(([c,l])=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'rgba(255,255,255,0.4)'}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
                  </div>
                ))}
              </div>
              <div style={{height:130,overflow:'hidden',position:'relative'}}>
                {ready && (
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={esData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="day" tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide domain={[0,12]}/>
                      <Tooltip contentStyle={TT}/>
                      <Line type="monotone" dataKey="energia" stroke="#00C896"
                        strokeWidth={2} dot={{fill:'#00C896',r:3}} connectNulls/>
                      <Line type="monotone" dataKey="sono"    stroke="#9D5CF5"
                        strokeWidth={2} dot={{fill:'#9D5CF5',r:3}} connectNulls/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Heatmap */}
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:16,marginBottom:12}}>
              <div style={{fontFamily:'Inter, sans-serif',fontSize:13,fontWeight:700,color:'#fff',marginBottom:2}}>
                Heatmap de Consistência
              </div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:10}}>
                Verde = dia completo · Roxo = parcial · Escuro = sem registo
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4}}>
                {['S','T','Q','Q','S','S','D'].map((d,i)=>(
                  <div key={i} style={{fontSize:9,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>{d}</div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
                {heatmap.map((v,i)=>(
                  <div key={i} style={{background:hmColor[v],borderRadius:4,aspectRatio:'1'}}/>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,marginTop:8}}>
                {([['#1C2030','Sem registo'],['#534AB7','Parcial'],['#1ECBB4','Completo']] as [string,string][]).map(([c,l])=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:3}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                    <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo da semana */}
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',marginBottom:10}}>Resumo da semana</div>
              {[
                {l:'Hábitos concluídos', v:`${stats.thisDone} de ${stats.thisTotal}`, c:stats.consistency>=70?'#00C896':'#F5C842'},
                {l:'Check-ins da semana',v:`${xpData.reduce((a,d)=>a+d.ci,0)}`,       c:'#9D5CF5'},
                {l:'Ritmo atual',        v:`${ritmo}`,                                c:'#F5C842'},
                {l:'Streak actual',      v:`${profile.streak_current} dias 🔥`,        c:'#F5C842'},
              ].map(({l,v,c})=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
                  <span style={{color:'rgba(255,255,255,0.6)'}}>{l}</span>
                  <span style={{color:c,fontFamily:'Inter, sans-serif',fontWeight:600,lineHeight:1}}>{v}</span>
                </div>
              ))}
            </div>

          </div>
        </>
      )}

      <Nav />
    </main>
  )
}
