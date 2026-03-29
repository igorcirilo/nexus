// src/app/page.tsx
// Redirect: onboarding se novo utilizador, /hoje se já onboarded
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export default async function Root() {
  // Redirect simples — a lógica de onboarding é feita client-side na Home
  redirect('/hoje')
}
