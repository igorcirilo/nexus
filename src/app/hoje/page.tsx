import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { getProfile, getCheckinsForDate, getHabitsWithLogs } from '@/lib/supabase'
import { todayISO } from '@/lib/date'
import type { Profile, Checkin, Habit } from '@/types'
import HojeClient from './HojeClient'

type HabitWithLog = Habit & { habit_logs?: { completed: boolean; date: string }[] }

// Server Component: auth + leituras do dia (perfil, check-ins, hábitos) no
// servidor. As mutações de gamificação ficam no client island (HojeClient).
export default async function HojePage() {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/auth')

  const today = todayISO()
  const [profileRaw, checkinsRaw, habitsRaw] = await Promise.all([
    getProfile(user.id, sb),
    getCheckinsForDate(user.id, today, sb),
    getHabitsWithLogs(user.id, today, sb),
  ])
  const profile = (profileRaw ?? null) as Profile | null

  // Quem ainda não fez o diagnóstico vai para o onboarding.
  if (profile && !profile.onboarded) redirect('/onboarding-v2')

  // Legados (onboarded no programa antigo, sem nível de hábitos) veem o backfill.
  const noHabits = Boolean(profile?.onboarded && profile?.habit_level == null)

  return (
    <HojeClient
      userId={user.id}
      serverToday={today}
      initialProfile={profile}
      initialCheckins={(checkinsRaw ?? []) as Checkin[]}
      initialHabits={(habitsRaw ?? []) as HabitWithLog[]}
      initialNoHabits={noHabits}
    />
  )
}
