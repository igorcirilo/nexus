import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { getProfile, getCheckinsForDate } from '@/lib/supabase'
import { getProgramDayByDate, getProgramTasks, getFirstProgramDayWithTasks } from '@/lib/program'
import { todayISO } from '@/lib/date'
import type { Profile, Checkin, ProgramDay, ProgramTask } from '@/types'
import HojeClient from './HojeClient'

type ProfileWithProgram = Profile & {
  program_id?: string | null
  onboarding_version?: number | null
}

// Server Component: faz a auth e busca os dados de LEITURA do dia no servidor.
// As mutações de gamificação (streak, badges, login bónus) ficam no client island.
export default async function HojePage() {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/auth')

  const today = todayISO()
  const [profileRaw, checkinsRaw] = await Promise.all([
    getProfile(user.id, sb),
    getCheckinsForDate(user.id, today, sb),
  ])
  const profile = (profileRaw ?? null) as ProfileWithProgram | null
  const checkins = (checkinsRaw ?? []) as Checkin[]

  const hasV2 = Boolean(profile && profile.program_id && (profile.onboarding_version ?? 1) >= 2)
  if (profile && !profile.onboarded && !hasV2) redirect('/onboarding-v2')

  const noProgram = Boolean(profile && !hasV2)

  let programDay: ProgramDay | null = null
  let tasks: ProgramTask[] = []
  if (hasV2 && profile?.program_id) {
    programDay = await getProgramDayByDate(profile.program_id, new Date(), sb)
    if (programDay) {
      tasks = await getProgramTasks(programDay.id, sb)
      if (tasks.length === 0) {
        const fallback = await getFirstProgramDayWithTasks(profile.program_id, sb)
        if (fallback) {
          programDay = fallback
          tasks = await getProgramTasks(fallback.id, sb)
        }
      }
    }
  }

  return (
    <HojeClient
      userId={user.id}
      serverToday={today}
      initialProfile={profile}
      initialCheckins={checkins}
      initialProgramDay={programDay}
      initialTasks={tasks}
      initialNoProgram={noProgram}
    />
  )
}
