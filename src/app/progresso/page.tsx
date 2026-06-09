'use client'
// src/app/progresso/page.tsx — Evolução + Dashboard — layout original + heatmap verde/roxo/escuro
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import Nav from '@/components/Nav'
import ProgressoHub from '@/components/progresso/ProgressoHub'
import { supabase, getProfile, getUserBadges, getWeeklyStats } from '@/lib/supabase'
import { xpForLevel, AREA_META, TITLES } from '@/types'
import { format, subDays } from 'date-fns'
import type { Profile, UserBadge } from '@/types'

type AppTab  = 'resumo' | 'evolucao' | 'stats'
type HeatVal = 'none' | 'partial' | 'full'

const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const ALL_BADGES = [
  { key:'streak_7',    icon:'🔥', name:'7 dias',        xp:100,  desc:'7 dias consecutivos'    },
  { key:'streak_14',   icon:'🔥', name:'14 dias',       xp:150,  desc:'Duas semanas seguidas'  },
  { key:'streak_30',   icon:'🏆', name:'30 dias',       xp:500,  desc:'Um mês de consistência' },
  { key:'streak_90',   icon:'💎', name:'90 dias',       xp:2000, desc:'Antifrágil — 3 meses'  },
  { key:'energy_max',  icon:'⚡', name:'Energia máx',  xp:50,   desc:'Energia 10/10'          },
  { key:'mission_done',icon:'🎯', name:'Missão feita', xp:75,   desc:'Missão 100% concluída'  },
  { key:'focus_10',    icon:'🧠', name:'Foco x10',     xp:200,  desc:'10 sessões Pomodoro'    },
  { key:'all_habits',  icon:'✨', name:'Dia perfeito', xp:150,  desc:'Todos os hábitos'       },
]

type AreaProgress = {
  key:string; label:string; icon:string; color:string
  pct:number; done:number; total:number
}

export default function ProgressoPage() {
  const [tab,         setTab]         = useState<AppTab>('resumo')
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [badges,      setBadges]      = useState<UserBadge[]>([])
  const [areas,       setAreas]       = useState<AreaProgress[]>([])
  const [activeBadge, setActiveBadge] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)

  const [xpData,  setXpData]  = useState<{day:string;xp:number;hab:number;ci:number}[]>([])
  const [esData,  setEsData]  = useState<{day:string;energia:number|null;sono:number|null}[]>([])
  const [heatmap, setHeatmap] = useState<HeatVal[]>([])
  const [stats,   setStats]   = useState({
    consistency:0, xpWeek:0, sleep:0, energy:0,
    prevConsistency:0, xpTrend:0, thisDone:0, thisTotal:0, checkinsToday:0,
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }

      const since7  = format(subDays(new Date(), 6),  'yyyy-MM-dd')
      const since14 = format(subDays(new Date(), 13), 'yyyy-MM-dd')
      const since28 = format(subDays(new Date(), 27), 'yyyy-MM-dd')
      const today   = format(new Date(), 'yyyy-MM-dd')

      const [prof, ub, weekly,
        { data: logs14 }, { data: logs28 }, { data: ci14 }, { data: habits }
      ] = await Promise.all([
        getProfile(user.id),
        getUserBadges(user.id),
        getWeeklyStats(user.id),
        supabase.from('habit_logs').select('date,completed,habit_id')
          .eq('user_id',user.id).gte('date',since14).lt('date',since7),
        supabase.from('habit_logs').select('date,completed')
          .eq('user_id',user.id).gte('date',since28),
        supabase.from('checkins').select('date,phase,xp_earned')
          .eq('user_id',user.id).gte('date',since14).lt('date',since7),
        supabase.from('habits').select('id,area,xp_reward')
          .eq('user_id',user.id).eq('active',true),
      ])

      setProfile(prof)
      setBadges(ub as UserBadge[])

      // ── XP map ──────────────────────────────────────────────────────────
      type HabitRow = { id:string; area:string; xp_reward:number }
      const xpMap: Record<string,number> = {}
      ;(habits ?? [] as HabitRow[]).forEach((h:HabitRow) => { xpMap[h.id] = h.xp_reward })

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

      // ── XP por dia ──────────────────────────────────────────────────────
      type LogRow7 = { date:string; completed:boolean; habit_id:string }
      type CIRow   = {
        date:string; phase?:string|null; energy?:number|null
        sleep_hours?:number|null; mood?:number|null; xp_earned?:number|null
      }
      const xpByDay = Array.from({length:7},(_,i) => {
        const d     = subDays(new Date(), 6-i)
        const day   = format(d,'yyyy-MM-dd')
        const habXP = (weekly.logs as LogRow7[])
          .filter(l => l.date===day && l.completed)
          .reduce((a:number,l:LogRow7) => a+(xpMap[l.habit_id]??10), 0)
        const ciXP  = (weekly.checkins as CIRow[])
          .filter(c => c.date===day)
          .reduce((a:number,c:CIRow) => a+(c.xp_earned??0), 0)
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
      type LogH = { habit_id:string; completed:boolean }
      type CIXp = { xp_earned:number }

      const thisDone  = (weekly.logs as LogC[]).filter(l => l.completed).length
      const thisTotal = (weekly.logs as LogC[]).length
      const prevDone  = (logs14 as LogC[] ?? []).filter(l => l.completed).length
      const prevTotal = (logs14 as LogC[] ?? []).length
      const consistency     = thisTotal > 0 ? Math.round(thisDone/thisTotal*100) : 0
      const prevConsistency = prevTotal > 0 ? Math.round(prevDone/prevTotal*100) : 0
      const xpWeek  = xpByDay.reduce((a,d) => a+d.xp, 0)
      const prevXP  =
        (logs14 as LogH[] ?? []).filter(l => l.completed)
          .reduce((a:number,l:LogH) => a+(xpMap[l.habit_id]??10), 0) +
        (ci14 as CIXp[] ?? []).reduce((a:number,c:CIXp) => a+(c.xp_earned??0), 0)
      const ciAll = (weekly.checkins as CIRow[]).filter(c => c.energy)
      const slAll = (weekly.checkins as CIRow[]).filter(c => c.sleep_hours)
      const avgE  = ciAll.length > 0
        ? Math.round(ciAll.reduce((a:number,c:CIRow) => a+(c.energy??0),0)/ciAll.length*10)/10 : 0
      const avgS  = slAll.length > 0
        ? Math.round(slAll.reduce((a:number,c:CIRow) => a+(c.sleep_hours??0),0)/slAll.length*10)/10 : 0
      const checkinsToday = (weekly.checkins as CIRow[]).filter(c => c.date===today).length

      setStats({ consistency, prevConsistency, xpWeek, xpTrend:xpWeek-prevXP,
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

  const level = profile.level
  const xp    = profile.xp_total
  const prev  = xpForLevel(level-1)
  const next  = xpForLevel(level)
  const pct   = Math.min(100, Math.round(((xp-prev)/(next-prev))*100))

  if (tab === 'resumo') {
    return (
      <main style={{ paddingBottom: 100, minHeight: '100vh', background: '#07070F' }}>
        <ProgressoHub
          profile={profile}
          areas={areas}
          badges={badges}
          earnedKeys={earned}
          consistency={stats.consistency}
          xpData={xpData.map(d => ({ day: d.day, xp: d.xp }))}
          onNavigate={setTab}
        />
        <Nav />
      </main>
    )
  }

  function streakProg(key:string) {
    const s = profile!.streak_current
    if (key==='streak_7')  return { cur:Math.min(s,7),  max:7  }
    if (key==='streak_14') return { cur:Math.min(s,14), max:14 }
    if (key==='streak_30') return { cur:Math.min(s,30), max:30 }
    if (key==='streak_90') return { cur:Math.min(s,90), max:90 }
    return null
  }

  return (
    <main style={{paddingBottom:100,minHeight:'100vh'}}>

      {/* ── Header + tabs ──────────────────────────────────────────────── */}
      <div style={{padding:'28px 20px 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <button onClick={()=>setTab('resumo')} style={{
            background:'none',border:'none',cursor:'pointer',color:'var(--text3)',
            display:'flex',alignItems:'center',gap:4,fontSize:13,padding:'4px 0',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Resumo
          </button>
        </div>
        <h1 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:22,marginBottom:4,lineHeight:1.2}}>
          Progresso
        </h1>
        <p style={{fontSize:12,color:'var(--text3)',marginBottom:16,lineHeight:1.4}}>
          Evolução semanal, consistência e comparação contigo mesmo.
        </p>
        <div style={{display:'flex',background:'var(--bg2)',borderRadius:14,padding:4,gap:4,border:'0.5px solid var(--border)'}}>
          {([{k:'evolucao',l:'Evolução',i:'⚡'},{k:'stats',l:'Dashboard',i:'📊'}] as const).map(({k,l,i}) => (
            <button key={k} onClick={()=>setTab(k)} style={{
              flex:1,padding:'11px 8px',borderRadius:10,border:'none',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:7,
              background:tab===k?'var(--bg1)':'transparent',
              color:tab===k?'var(--gold)':'var(--text3)',
              fontFamily:'Syne, sans-serif',fontWeight:tab===k?600:400,fontSize:14,
              transition:'all .15s',boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.3)':'none',
            }}>
              <span style={{fontSize:16}}>{i}</span>{l}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB EVOLUÇÃO
      ══════════════════════════════════════════════════════════════════ */}
      {tab==='evolucao' && (
        <>
          {/* Level card */}
          <div style={{
            margin:'16px 20px 0',padding:'22px 20px',borderRadius:20,
            background:'var(--bg2)',border:'0.5px solid rgba(232,168,56,.25)',
            position:'relative',overflow:'hidden',
          }}>
            <div style={{position:'absolute',top:-40,right:-40,width:180,height:180,
              borderRadius:'50%',background:'rgba(232,168,56,.06)',pointerEvents:'none'}}/>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{
                    background:'rgba(232,168,56,.12)',border:'0.5px solid rgba(232,168,56,.3)',
                    borderRadius:10,padding:'4px 12px',fontFamily:'Syne, sans-serif',
                    fontWeight:800,fontSize:13,color:'var(--gold)',letterSpacing:'.5px',lineHeight:1.4,
                  }}>
                    NÍV. {level}
                  </div>
                  <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18,color:'var(--text1)',lineHeight:1.2}}>
                    {profile.title}
                  </div>
                </div>
                <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.4}}>{TITLES[profile.title]??''}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'Syne, sans-serif',fontWeight:800,fontSize:30,color:'var(--text1)',lineHeight:1}}>
                  {xp.toLocaleString('pt-PT')}
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>XP total</div>
              </div>
            </div>
            <div style={{background:'var(--bg3)',borderRadius:100,height:8,marginBottom:6}}>
              <div style={{height:'100%',borderRadius:100,
                background:'linear-gradient(90deg,var(--gold),#F0C060)',
                width:`${pct}%`,transition:'width .8s ease'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
              <span>{pct}% para Nível {level+1}</span>
              <span>{(next-xp).toLocaleString('pt-PT')} XP em falta</span>
            </div>
          </div>

          {/* Streak pills */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'12px 20px 0'}}>
            {([
              {l:'Streak',     v:`${profile.streak_current}`,u:'dias',c:'var(--gold)',   i:'🔥',flame:true},
              {l:'Recorde',    v:`${profile.streak_best}`,   u:'dias',c:'var(--accent)', i:'🏅',flame:false},
              {l:'Conquistas', v:`${earned.size}/${ALL_BADGES.length}`,u:'',c:'var(--teal)',i:'✨',flame:false},
            ] as const).map(({l,v,u,c,i,flame})=>(
              <div key={l} style={{
                background:'var(--bg2)',border:'0.5px solid var(--border)',
                borderRadius:14,padding:'14px 12px',textAlign:'center',
              }}>
                <div style={{
                  fontSize:20,marginBottom:6,display:'inline-block',
                  ...(flame?{animation:'flame 1.8s ease-in-out infinite',transformOrigin:'bottom center'}:{}),
                }}>{i}</div>
                <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:20,color:c,lineHeight:1}}>
                  {v}
                </div>
                {u && <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{u}</div>}
                <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Radar chart — Roda da Vida */}
          <div style={{padding:'20px 20px 0'}}>
            <div style={{
              fontFamily:'Syne, sans-serif',fontSize:12,fontWeight:600,
              color:'var(--text3)',textTransform:'uppercase',letterSpacing:1,marginBottom:10,
            }}>
              Equilíbrio de vida
            </div>
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:16,padding:'16px 8px'}}>
              <div style={{height:220,overflow:'hidden',position:'relative'}}>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={areas.map(a=>({subject:a.label.split(' ')[0],value:a.pct,fullMark:100}))}>
                    <PolarGrid stroke="rgba(255,255,255,.08)"/>
                    <PolarAngleAxis dataKey="subject" tick={{fill:'#9BA0B0',fontSize:11}}/>
                    <Radar name="Progresso" dataKey="value"
                      stroke="#7F77DD" fill="#7F77DD" fillOpacity={0.25} strokeWidth={2}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Progresso por área */}
          <div style={{padding:'16px 20px 0'}}>
            <div style={{
              fontFamily:'Syne, sans-serif',fontSize:12,fontWeight:600,
              color:'var(--text3)',textTransform:'uppercase',letterSpacing:1,marginBottom:10,
            }}>
              Progresso por Área — 30 dias
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {areas.map(a=>(
                <div key={a.key} style={{
                  background:'var(--bg2)',border:'0.5px solid var(--border)',
                  borderRadius:14,padding:'13px 16px',
                }}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:18}}>{a.icon}</span>
                      <span style={{fontSize:13,fontWeight:500,color:'var(--text1)'}}>{a.label}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:11,color:'var(--text3)'}}>{a.done}/{a.total>0?a.total:'—'}</span>
                      <span style={{
                        fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,lineHeight:1,
                        color:a.pct>=70?'var(--teal)':a.pct>=40?'var(--gold)':'var(--text3)',
                        minWidth:36,textAlign:'right',
                      }}>
                        {a.total>0?`${a.pct}%`:'—'}
                      </span>
                    </div>
                  </div>
                  <div style={{background:'var(--bg3)',borderRadius:100,height:5}}>
                    <div style={{
                      height:'100%',borderRadius:100,width:`${a.pct}%`,
                      background:a.pct>=70?'var(--teal)':a.pct>=40?'var(--gold)':a.color,
                      transition:'width .8s ease',
                    }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conquistas */}
          <div style={{padding:'20px 20px 0'}}>
            <div style={{
              fontFamily:'Syne, sans-serif',fontSize:12,fontWeight:600,
              color:'var(--text3)',textTransform:'uppercase',letterSpacing:1,marginBottom:10,
            }}>
              Conquistas
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {ALL_BADGES.map(b => {
                const isE = earned.has(b.key)
                const isA = activeBadge===b.key
                const sp  = streakProg(b.key)
                return (
                  <button key={b.key} onClick={()=>setActiveBadge(isA?null:b.key)} style={{
                    background:isA?(isE?'rgba(232,168,56,.08)':'var(--bg3)'):'var(--bg2)',
                    border:isA?(isE?'1px solid rgba(232,168,56,.3)':'0.5px solid var(--accent)'):'0.5px solid var(--border)',
                    borderRadius:14,padding:'14px 8px',cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                    filter:isE?'none':'grayscale(.8)',opacity:isE?1:0.55,
                    transform:isA?'scale(1.03)':'scale(1)',transition:'all .15s',
                  }}>
                    <span style={{fontSize:24}}>{b.icon}</span>
                    <span style={{fontSize:10,color:isE?'var(--text1)':'var(--text3)',textAlign:'center',lineHeight:1.3}}>
                      {b.name}
                    </span>
                    {isE && <span style={{fontSize:9,color:'var(--teal)'}}>+{b.xp} XP</span>}
                    {isA && !isE && sp && (
                      <div style={{width:'100%',marginTop:2}}>
                        <div style={{background:'var(--bg3)',borderRadius:100,height:3}}>
                          <div style={{height:'100%',borderRadius:100,background:'var(--gold)',
                            width:`${Math.round(sp.cur/sp.max*100)}%`}}/>
                        </div>
                        <div style={{fontSize:9,color:'var(--gold)',textAlign:'center',marginTop:3}}>
                          {sp.cur}/{sp.max}
                        </div>
                      </div>
                    )}
                    {isA && isE  && <div style={{fontSize:9,color:'var(--teal)',textAlign:'center'}}>Conquistado ✓</div>}
                    {isA && !isE && !sp && <div style={{fontSize:9,color:'var(--text3)',textAlign:'center',lineHeight:1.3}}>{b.desc}</div>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Percurso de títulos */}
          <div style={{margin:'20px 20px 0',padding:'16px',borderRadius:14,background:'var(--bg2)',border:'0.5px solid var(--border)'}}>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>Percurso de Títulos</div>
            {[
              {t:'Recruta',     min:1,  max:2 },
              {t:'Consistente', min:3,  max:4 },
              {t:'Focado',      min:5,  max:7 },
              {t:'Estrategista',min:8,  max:10},
              {t:'Imparável',   min:11, max:14},
              {t:'Antifrágil',  min:15, max:20},
            ].map(t => {
              const isCur  = level >= t.min && level <= t.max
              const isPast = level > t.max
              return (
                <div key={t.t} style={{display:'flex',alignItems:'center',gap:10,padding:'5px 0'}}>
                  <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                    background:isPast?'var(--teal)':isCur?'var(--gold)':'var(--bg3)'}}/>
                  <div style={{flex:1,fontSize:13,color:isCur?'var(--text1)':'var(--text3)',fontWeight:isCur?600:400}}>
                    {t.t}
                  </div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>Nív. {t.min}–{t.max}</div>
                  {isCur  && <div style={{fontSize:10,color:'var(--gold)',fontFamily:'Syne, sans-serif'}}>← aqui</div>}
                  {isPast && <div style={{fontSize:10,color:'var(--teal)'}}>✓</div>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB DASHBOARD
      ══════════════════════════════════════════════════════════════════ */}
      {tab==='stats' && (
        <>
          {/* Header check-ins */}
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:'16px 20px 0'}}>
            <div style={{fontSize:12,color:'var(--text3)'}}>Esta semana</div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18,color:'var(--gold)',lineHeight:1}}>
                {stats.checkinsToday}/3
              </div>
              <div style={{fontSize:11,color:'var(--text3)'}}>check-ins hoje</div>
            </div>
          </div>

          {/* Métricas 2×2 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'10px 20px 0'}}>
            {[
              {
                l:'Consistência', v:`${stats.consistency}%`, c:'var(--teal)',
                trend:`${stats.consistency>=stats.prevConsistency?'↑':'↓'} vs semana passada`,
                up:stats.consistency>=stats.prevConsistency,
              },
              {
                l:'XP esta semana', v:`${stats.xpWeek}`, c:'var(--gold)',
                trend:`${stats.xpTrend>=0?'↑ +':'↓ '}${Math.abs(stats.xpTrend)} vs ant.`,
                up:stats.xpTrend>=0,
              },
              {
                l:'Energia média',
                v:stats.energy>0?`${stats.energy}/10`:'—', c:'var(--accent)',
                sub:stats.energy>=7?'Boa semana ⚡':stats.energy>0?'Recupera o sono':'Sem dados',
              },
              {
                l:'Sono médio',
                v:stats.sleep>0?`${stats.sleep}h`:'—', c:'var(--text1)',
                sub:stats.sleep>=7?'Dentro do ideal':stats.sleep>0?'Abaixo do ideal':'Sem dados',
              },
            ].map(({l,v,c,trend,sub,up})=>(
              <div key={l} style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>{l}</div>
                <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:22,color:c,marginBottom:3,lineHeight:1}}>
                  {v}
                </div>
                {trend && <div style={{fontSize:11,color:up?'var(--teal)':'#E24B4A'}}>{trend}</div>}
                {sub   && <div style={{fontSize:11,color:'var(--text3)'}}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Mentor */}
          <div style={{
            margin:'10px 20px 0',padding:'14px 16px',borderRadius:14,
            background:'var(--bg2)',border:'0.5px solid rgba(30,203,180,.18)',
            fontSize:13,color:'var(--text2)',lineHeight:1.6,
          }}>
            <span style={{color:'var(--teal)',fontWeight:500}}>Mentor: </span>
            {stats.consistency>=80
              ? `Consistência de ${stats.consistency}% — execução real.`
              : `${stats.consistency}% esta semana. Foca num hábito de cada vez.`}
            {' '}<span style={{color:'var(--gold)'}}>
              Próxima conquista:{' '}
              {profile.streak_current<7
                ? `streak de 7 dias — faltam ${7-profile.streak_current}`
                : profile.streak_current<14
                  ? `streak de 14 dias — faltam ${14-profile.streak_current}`
                  : `streak de 30 dias — faltam ${30-profile.streak_current}`
              } dias.
            </span>
          </div>

          <div style={{padding:'12px 20px 0'}}>

            {/* XP diário */}
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:16,padding:'16px',marginBottom:12}}>
              <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>XP diário — hábitos + check-ins</div>
              <div style={{display:'flex',gap:14,marginBottom:10}}>
                {([['#534AB7','Hábitos'],['#E8A838','Check-ins']] as [string,string][]).map(([c,l])=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
                  </div>
                ))}
              </div>
              <div style={{height:150,overflow:'hidden',position:'relative'}}>
                {ready && (
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={xpData} barGap={2} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="day" tick={{fill:'#5A6070',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/>
                      <Tooltip contentStyle={TT}
                        formatter={(v:number,n:string)=>[v,n==='hab'?'Hábitos XP':'Check-in XP']}/>
                      <Bar dataKey="hab" name="hab" stackId="a" fill="#534AB7" radius={[0,0,0,0]}/>
                      <Bar dataKey="ci"  name="ci"  stackId="a" fill="#E8A838" radius={[5,5,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Energia + Sono */}
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:16,padding:'16px',marginBottom:12}}>
              <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>Energia e Sono — 7 dias</div>
              <div style={{display:'flex',gap:14,marginBottom:10}}>
                {([['var(--teal)','Energia'],['var(--accent)','Sono (h)']] as [string,string][]).map(([c,l])=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
                  </div>
                ))}
              </div>
              <div style={{height:130,overflow:'hidden',position:'relative'}}>
                {ready && (
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={esData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="day" tick={{fill:'#5A6070',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide domain={[0,12]}/>
                      <Tooltip contentStyle={TT}/>
                      <Line type="monotone" dataKey="energia" stroke="var(--teal)"
                        strokeWidth={2} dot={{fill:'var(--teal)',r:3}} connectNulls/>
                      <Line type="monotone" dataKey="sono"    stroke="var(--accent)"
                        strokeWidth={2} dot={{fill:'var(--accent)',r:3}} connectNulls/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Heatmap — verde=completo · roxo=parcial · escuro=sem registo */}
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:16,padding:16,marginBottom:12}}>
              <div style={{fontFamily:'Syne, sans-serif',fontSize:13,fontWeight:600,color:'var(--text1)',marginBottom:2}}>
                Heatmap de Consistência
              </div>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
                Verde = dia completo · Roxo = parcial · Escuro = sem registo
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4}}>
                {['S','T','Q','Q','S','S','D'].map((d,i)=>(
                  <div key={i} style={{fontSize:9,color:'var(--text3)',textAlign:'center'}}>{d}</div>
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
                    <span style={{fontSize:9,color:'var(--text3)'}}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo da semana */}
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
              <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>Resumo da semana</div>
              {[
                {l:'Hábitos concluídos', v:`${stats.thisDone} de ${stats.thisTotal}`, c:stats.consistency>=70?'var(--teal)':'var(--gold)'},
                {l:'XP de hábitos',      v:`${xpData.reduce((a,d)=>a+d.hab,0)} XP`,  c:'var(--accent)'},
                {l:'XP de check-ins',    v:`${xpData.reduce((a,d)=>a+d.ci,0)} XP`,   c:'var(--gold)'},
                {l:'Streak actual',      v:`${profile.streak_current} dias 🔥`,        c:'var(--gold)'},
              ].map(({l,v,c})=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
                  <span style={{color:'var(--text2)'}}>{l}</span>
                  <span style={{color:c,fontFamily:'Syne, sans-serif',fontWeight:600,lineHeight:1}}>{v}</span>
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
