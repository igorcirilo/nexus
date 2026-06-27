# Notificações agendadas (pg_cron → Edge Function → Web Push)

Documentação **fiel ao que está em produção** no NEXUS, pensada para ser
replicada noutro projeto **Next.js + Supabase + Vercel**.

> ⚠️ **Segurança:** no estado atual deste projeto o `CRON_SECRET` e a URL base
> estão **hardcoded** dentro do comando do job (`cron.job.command`), em texto
> simples. Funciona, mas qualquer um com acesso de leitura a `cron.job` vê o
> segredo. A [secção 7](#7-versão-recomendada-com-vault) mostra a versão com
> **Vault** (recomendada para um projeto novo). **Nunca** faças commit do valor
> literal do segredo — usa sempre placeholders.

---

## Arquitetura

O agendamento corre **inteiramente dentro do Supabase** (o Vercel Cron **não** é
usado). A cada minuto, o `pg_cron` faz um `http_post` assíncrono (via `pg_net`)
para uma **Edge Function** Deno, que decide o que enviar.

```
pg_cron (* * * * *)
   └─ net.http_post(url = Edge Function, header x-cron-secret)   [pg_net, assíncrono]
        └─ Edge Function send-reminders (verify_jwt = false)
             ├─ valida header x-cron-secret == CRON_SECRET
             ├─ lê reminders / agenda_events / habits
             ├─ calcula hora local por utilizador (push_subscriptions.timezone)
             └─ web-push → endpoints dos browsers
```

Não há lógica de envio em SQL — o SQL só **agenda** e **chama** o HTTP. Toda a
decisão (que utilizador, que hora local, que mensagem) está na Edge Function.

---

## 1. Extensões

Confirmado por `list_extensions` (versões reais em produção):

| Extensão | Versão | Schema | Papel |
|---|---|---|---|
| `pg_cron` | **1.6.4** | `pg_catalog` | Agendador (cron dentro do Postgres) |
| `pg_net` | **0.20.0** | `public` | HTTP **assíncrono** a partir do banco |
| `supabase_vault` | 0.3.1 | `vault` | Disponível; **não usado** aqui (ver secção 7) |

- A extensão `http` (síncrona) **não** é usada — `pg_net` é assíncrono e não
  bloqueia o cron.
- Ativadas por SQL (ou via Dashboard → Database → Extensions; é o mesmo
  `CREATE EXTENSION`):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

> `pg_cron` só pode ser instalado na base `postgres`.

---

## 2. Chamada HTTP a partir do banco

O cron chama um **endpoint HTTP** — a Edge Function — com `net.http_post`.
Comando **exato** do job (segredo substituído por placeholder):

```sql
select net.http_post(
  url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', '<CRON_SECRET>'
  ),
  body    := '{}'::jsonb
);
```

- **Método:** `POST` · **Corpo:** `{}` (a função descobre tudo sozinha) ·
  **Auth:** header `x-cron-secret`.
- **Endpoint:** `https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders`.
- **O que faz:** valida o `x-cron-secret`; lê `reminders` (ativos),
  `agenda_events` (do dia, ainda não notificados) e `habits` (ativos); para cada
  utilizador calcula a **hora/data local** via `push_subscriptions.timezone`; e
  envia Web Push do que “bate” no minuto atual. Marca `last_sent_at` /
  `notified_at` / `last_notified_at` para não duplicar.

`pg_net` é **assíncrono**: o `http_post` devolve logo um `id` e enfileira o
pedido; a resposta cai depois em `net._http_response` (ver secção 6).

---

## 3. Segredos / Autenticação

Como `verify_jwt = false`, a função é pública e o `x-cron-secret` é a **única**
barreira de autenticação — por isso o segredo tem de ser forte e privado.

**Lado da Edge Function** (definidos como *Function Secrets*, **não** estão no
banco nem em migration):

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — chaves Web Push.
- `CRON_SECRET` — segredo partilhado para autenticar o cron.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` — **injetados automaticamente**
  pela Supabase em qualquer Edge Function.
- (Opcionais) `REMINDER_TZ` (fallback de fuso), `ALLDAY_NOTIFY_HHMM` (hora local
  dos eventos de dia inteiro, default `09:00`).

Validação na função (`index.ts`):

```ts
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }
  // ...
})
```

**Lado do cron:** neste projeto o **mesmo** `CRON_SECRET` e a **URL base** estão
**hardcoded** no `cron.job.command`. **Não** se usa Vault aqui. Para a versão
com Vault (sem expor nada em `cron.job`), ver secção 7.

---

## 4. Agendamento (`cron.schedule`)

Existe **um único** job; serve todos os tipos (lembretes, eventos, hábitos),
porque a função decide a cada minuto o que “bate” na hora local de cada um.

| jobid | jobname | schedule | frequência |
|---|---|---|---|
| 1 | `nexus-send-reminders` | `* * * * *` | **a cada minuto** |

```sql
select cron.schedule(
  'nexus-send-reminders',   -- nome do job
  '* * * * *',              -- todos os minutos
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Para re-agendar/alterar, remove primeiro:

```sql
select cron.unschedule('nexus-send-reminders');
```

---

## 5. Migrations

> **Não existe** nenhuma função wrapper `SECURITY DEFINER`. O `cron.schedule`
> chama `net.http_post` **diretamente**.

Colunas de anti-duplicação (`last_sent_at`, `notified_at`, `last_notified_at`)
dispensam uma tabela de “já enviados” — a própria linha guarda o timestamp do
último envio.

### `notifications_push_v1.sql` — schema + extensões + agendamento

```sql
-- 1) Subscrições push do browser (uma linha por dispositivo/endpoint)
create table if not exists public.push_subscriptions (
  id         uuid not null default gen_random_uuid(),
  user_id    uuid not null,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- O utilizador só gere as próprias subscrições. A Edge Function usa a
-- service_role key (ignora RLS) para ler todas e enviar.
create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy push_subscriptions_update_own on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- 2) Anti-duplicação: marca o último envio de cada lembrete
alter table public.reminders
  add column if not exists last_sent_at timestamptz;

-- 3) Agendador: pg_cron chama a Edge Function a cada minuto
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- substituir <PROJECT_REF> e <CRON_SECRET>
select cron.schedule(
  'nexus-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

### `notifications_push_v2_timezone.sql` — fuso por dispositivo

```sql
alter table public.push_subscriptions
  add column if not exists timezone text;
```

### `notifications_push_v3_agenda.sql` — anti-dup dos eventos

```sql
alter table public.agenda_events
  add column if not exists notified_at timestamptz;
```

### `notifications_push_v4_habitos.sql` — anti-dup dos hábitos

```sql
alter table public.habits
  add column if not exists last_notified_at timestamptz;
```

---

## 6. Tratamento de erros / Observabilidade

Duas fontes — **e atenção à diferença entre elas**:

### a) `cron.job_run_details` — o *job* disparou?

```sql
select jobid, runid, status, return_message, start_time, end_time
from cron.job_run_details
order by start_time desc
limit 20;
```

Exemplo real:

```
jobid runid status     return_message start_time
1     1197  succeeded  1 row          2026-06-24 13:49:00+00
1     1196  succeeded  1 row          2026-06-24 13:48:00+00
```

> ⚠️ `succeeded` significa só que o `net.http_post` foi **enfileirado** — **não**
> que a Edge Function correu bem. Para isso, ver a resposta HTTP ↓

### b) `net._http_response` — a resposta real da função

```sql
select id, status_code, content_type, timed_out, error_msg,
       left(content, 200) as content_preview, created
from net._http_response
order by created desc
limit 20;
```

Exemplo real:

```
id    status_code content_preview              timed_out error_msg
1197  200         {"ok":true,"due":0,"sent":0} false     null
1196  200         {"ok":true,"due":0,"sent":0} false     null
```

O corpo `{"ok":true,"due":N,"sent":M}` vem da função (`due` = quantos “bateram”,
`sent` = pushes enviados) — é a melhor sonda de saúde. O `net._http_response` é
**limpo periodicamente** pelo pg_net (guarda só as respostas recentes).

Logs da função: Dashboard → Edge Functions → `send-reminders` → Logs.

### Retry / janela de tolerância

**Não há.** O modelo é *tick* a cada minuto + correspondência exata de `HH:MM`:

- Se um minuto falhar (função em erro/timeout), a notificação desse minuto
  **perde-se** — não há *catch-up*.
- A anti-duplicação usa `>= minuteStart` (início do minuto atual): evita
  reenvios no mesmo minuto, mas **não** recupera minutos perdidos.

---

## 7. Versão recomendada (com Vault)

Para **não** deixar o segredo/URL em claro no `cron.job`, guarda-os no Vault e
lê-os no comando do cron. Precisa de `supabase_vault` (já ativo por omissão na
Supabase).

```sql
-- guardar segredos uma vez
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');

-- agendar lendo do Vault (o command já não expõe os valores)
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Assim o `cron.job.command` mostra apenas o `select ... from
vault.decrypted_secrets`, e os valores ficam cifrados no Vault.

---

## 8. Passos manuais (NÃO ficam em migration)

1. **Gerar chaves VAPID:** `npx web-push generate-vapid-keys`.
2. **Definir Function Secrets** (Dashboard → Edge Functions → Secrets, ou
   `supabase secrets set`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, `CRON_SECRET` (e opcionais `REMINDER_TZ`,
   `ALLDAY_NOTIFY_HHMM`).
3. **Deploy da Edge Function** `send-reminders` com `--no-verify-jwt`
   (é deploy, não migration).
4. **Correr o `cron.schedule`** com os valores reais de `<PROJECT_REF>` e
   `<CRON_SECRET>` (a migration só tem placeholders).
5. **Frontend:** a chave **pública** VAPID tem de estar disponível no Next.js
   para o `pushManager.subscribe`.

### Passo-a-passo do zero (projeto novo)

1. **Extensões:** `create extension if not exists pg_cron; create extension if not exists pg_net;`
   (pg_cron só na base `postgres`).
2. **Tabela + RLS** (`push_subscriptions`) e colunas de anti-dup nas tabelas a
   notificar (secção 5).
3. **VAPID:** gera o par; mete os secrets + `CRON_SECRET` nos Function Secrets.
4. **Edge Function:** valida `x-cron-secret`, lê as tabelas, calcula hora local,
   envia `web-push`. Deploy com `verify_jwt = false`.
5. **Frontend:** regista o Service Worker, faz
   `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })`, e grava
   `endpoint / p256dh / auth / timezone` em `push_subscriptions`.
6. **Agendar** o job (`cron.schedule`, secção 4 — ou a versão com Vault da
   secção 7).
7. **Verificar:** `cron.job_run_details` + `net._http_response` (secção 6).

---

## 9. Edge Function — referência

Ficheiro real: [`supabase/functions/send-reminders/index.ts`](../supabase/functions/send-reminders/index.ts).

Pontos-chave da implementação:

- **Hora local por utilizador** via `Intl.DateTimeFormat` com o
  `push_subscriptions.timezone` (fallback `REMINDER_TZ`/UTC):

```ts
function nowParts(tz: string): { hhmm: string; dow: number; date: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return {
    hhmm: `${parts.hour}:${parts.minute}`,
    dow: DOW[parts.weekday as string] ?? 0,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  }
}
```

- **Lembretes:** correspondência por `days` (dia da semana) + `time` (`HH:MM`);
  anti-dup com `reminders.last_sent_at >= minuteStart`.
- **Eventos:** `agenda_events` do dia local; com hora → à hora marcada, dia
  inteiro → `ALLDAY_NOTIFY_HHMM` (`09:00`); anti-dup com `notified_at`.
- **Hábitos:** hora extraída de `time_window` (`'07:00-09:00'` → `07:00`); só
  ativos, salta os já concluídos hoje (`habit_logs`); anti-dup com
  `last_notified_at`. Rótulos sem hora (`Manhã`, `Todo o dia`) não notificam.
- **Limpeza de endpoints mortos:** num envio com `404`/`410`, a subscrição é
  apagada de `push_subscriptions`.
- **Resposta:** `{ ok: true, due, sent }` — visível em `net._http_response`.
