import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import CalendarioClient from './CalendarioClient'

// Server Component: auth no servidor; passa o userId ao client island, que
// gere a navegação/seleção interativa do calendário e busca os dados do mês.
export default async function CalendarioPage() {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/auth')

  return <CalendarioClient userId={user.id} />
}
