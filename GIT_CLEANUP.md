# Nexus — Limpeza do Git e variáveis de ambiente

## Diagnóstico

| Ficheiro | Estado | Acção |
|---|---|---|
| `.gitignore` | Apagado | **Restaurar** (incluído neste zip) |
| `node_modules/` | Untracked | **Ignorar** (não commitar) |
| `.next/` | Untracked | **Ignorar** (build local) |
| `.env.local` | Untracked | **Ignorar** (credenciais) |
| `public/sw.js` | Apagado | **Não restaurar** — é gerado no build |
| `public/workbox-*.js` | Apagado | **Não restaurar** — é gerado no build |
| `src/components/NightSummary.tsx` | Apagado | **Não restaurar** — criado por outra IA, não existe no projecto actual |
| `src/components/EvolutionAvatar.tsx` | Apagado | **Não restaurar** — idem |
| `src/lib/evolution.ts` | Apagado | **Não restaurar** — idem |
| `supabase/schema_completo.sql` | Untracked | **Commitar** |
| `SUPABASE_AUTH_CONFIG.md` | Untracked | **Commitar** |
| `src/app/progresso/` | Untracked | **Commitar** |
| `.env.local.example` | Apagado | **Restaurar** (incluído neste zip) |

---

## Sequência de comandos — executar por ordem

```bash
# 1. Entra na pasta do projecto
cd nexus-v4   # ou o nome da tua pasta

# 2. Copia os ficheiros deste zip por cima
#    (substitui src/, public/, .gitignore, .env.local.example, etc.)

# 3. Remove node_modules e .next do Git (se foram adicionados por engano)
git rm -r --cached node_modules/ 2>/dev/null || true
git rm -r --cached .next/ 2>/dev/null || true
git rm --cached .env.local 2>/dev/null || true

# 4. Adiciona o .gitignore novo
git add .gitignore

# 5. Adiciona todos os ficheiros válidos
git add src/
git add public/
git add supabase/
git add SUPABASE_AUTH_CONFIG.md
git add .env.local.example
git add package.json next.config.mjs tailwind.config.ts tsconfig.json

# 6. Verifica o que vai ser commitado
git status

# 7. Commit
git commit -m "fix: limpeza git, auth email+password, progresso unificado"

# 8. Push
git push origin main
```

---

## Variáveis de ambiente

O erro `supabaseUrl is required` acontece quando `.env.local` não existe ou está vazio.

**Localmente:**
```bash
# Copia o exemplo
cp .env.local.example .env.local

# Edita com os teus valores reais
# NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

**Na Vercel:**
1. Dashboard → o teu projecto → Settings → Environment Variables
2. Adiciona as duas variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Re-deploy

---

## Supabase — SQL seguro (sem recriar policies)

Se precisares de correr SQL sem erro de "policy already exists":

```sql
-- Correr APENAS se a coluna não existir ainda
alter table profiles add column if not exists fin_current_savings numeric(12,2) default 0;
alter table profiles add column if not exists onboarded boolean default false;

-- Marcar utilizadores existentes como onboarded
update profiles set onboarded = true where onboarded is false or onboarded is null;

-- Criar tabela agenda se não existir
create table if not exists agenda_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text not null, description text, date date not null,
  time time, end_time time, color text default '#E8A838',
  all_day boolean default false, created_at timestamptz default now()
);
alter table agenda_events enable row level security;
-- Só cria a policy se não existir:
do $$ begin
  create policy "Eventos próprios" on agenda_events for all using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
```

---

## Auth — confirmação

O ficheiro `src/app/auth/page.tsx` usa **email + password**:
- Registo: `supabase.auth.signUp()` + `signInWithPassword()`
- Login: `supabase.auth.signInWithPassword()`
- Recuperação: `supabase.auth.resetPasswordForEmail()`

**Sem magic link.** Se ainda aparecer pedido de magic link, é porque o Supabase tem "Confirm email" activo. Desactiva em:
Authentication → Providers → Email → "Confirm email" → OFF
