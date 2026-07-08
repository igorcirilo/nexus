// supabase/functions/delete-account/index.ts
//
// Apaga a conta do utilizador autenticado por completo (direito ao apagamento —
// LGPD art. 18 / GDPR art. 17):
//   1. valida o JWT da sessão (Authorization: Bearer <access_token>);
//   2. apaga todas as linhas de dados pessoais (tabelas com user_id);
//   3. apaga a linha de `profiles`;
//   4. remove o utilizador de auth (auth.admin.deleteUser) — precisa service_role.
//
// O cliente invoca via supabase.functions.invoke('delete-account').
//
// Deploy (uma vez):  supabase functions deploy delete-account
// Injetados automaticamente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//
// MANTER SINCRONIZADO com src/lib/account.ts → USER_DATA_TABLES.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Ordem filhos → pais (igual a src/lib/account.ts).
const USER_DATA_TABLES = [
  'habit_logs', 'habits', 'checkins', 'focus_sessions', 'user_badges',
  'goal_milestones', 'goals_90', 'reminders', 'agenda_events', 'day_item_checks', 'transactions',
  'user_assessments', 'life_area_scores', 'body_measurements', 'training_entries',
  'training_plans', 'diet_meals', 'diet_plans', 'book_bookmarks', 'book_highlights',
  'book_notes', 'book_progress', 'reading_sessions', 'reading_preferences', 'books',
  'quit_relapses', 'quit_habits', 'program_tasks', 'programs', 'weekly_challenges',
  'weekly_league_snapshots', 'push_subscriptions',
]

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Tabela inexistente (opcional/não implantada) não deve abortar o apagamento.
const IGNORABLE = new Set(['PGRST205', '42P01'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Sem sessão' }, 401)

  // Valida o JWT e obtém o utilizador (com a anon key + o token do utilizador).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return json({ error: 'Sessão inválida' }, 401)

  const userId = user.id
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 1+2. Apaga dados pessoais.
  const failed: string[] = []
  for (const table of USER_DATA_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error && !IGNORABLE.has(error.code ?? '')) failed.push(`${table}: ${error.message}`)
  }
  // 3. Apaga o perfil.
  const { error: profErr } = await admin.from('profiles').delete().eq('id', userId)
  if (profErr && !IGNORABLE.has(profErr.code ?? '')) failed.push(`profiles: ${profErr.message}`)

  // 4. Remove o utilizador de auth.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) return json({ error: `Falha ao remover a conta: ${delErr.message}`, partial: failed }, 500)

  return json({ ok: true, warnings: failed })
})
