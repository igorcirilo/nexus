import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { getTrainingPlans, getDietPlans, getProfile } from '@/lib/supabase'
import type { TrainingPlan, DietPlan, Profile } from '@/types'
import CorpoClient from './CorpoClient'

// Server Component: auth no servidor + busca de planos e perfil (leituras),
// passados ao client island. A interatividade fica em CorpoClient e filhos.
export default async function CorpoPage() {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/auth')

  const [training, diet, profile] = await Promise.all([
    getTrainingPlans(user.id, sb),
    getDietPlans(user.id, sb),
    getProfile(user.id, sb),
  ])

  return (
    <CorpoClient
      userId={user.id}
      initialProfile={(profile ?? null) as Profile | null}
      initialTrainingPlans={(training ?? []) as TrainingPlan[]}
      initialDietPlans={(diet ?? []) as DietPlan[]}
    />
  )
}
