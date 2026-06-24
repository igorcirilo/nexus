# Notificações (Web Push) — guia de setup

Sistema de notificações dos lembretes do NEXUS. Tudo **dentro do free tier**.

## Como funciona

```
Browser do user ──subscribe──► tabela push_subscriptions (Supabase)
                                         ▲
pg_cron (a cada minuto)                  │ service_role
   └─► net.http_post ──► Edge Function `send-reminders`
                              └─ lê `reminders` que batem hora/dia agora
                              └─ envia Web Push (VAPID) para cada subscrição
                              └─ marca reminders.last_sent_at
```

- **O cron do Vercel não é usado.** No plano Hobby ele só corre 1×/dia. Em vez
  disso usamos o **pg_cron do Supabase**, que corre a cada minuto sem custo.
- Funciona com a app fechada no **Android/desktop**. No **iOS** só funciona se a
  app estiver **instalada no ecrã inicial** (limitação da Apple ao Web Push).
- Custo: Edge Functions free = 500k invocações/mês. 1×/min ≈ 43k/mês. Folgado.

## Componentes no repositório

| Ficheiro | Papel |
|---|---|
| `worker/index.js` | Handler `push` + `notificationclick` (injetado no SW do next-pwa) |
| `src/lib/push.ts` | Subscrever/cancelar no cliente e gravar em `push_subscriptions` |
| `src/components/perfil/PerfilHub.tsx` | Toggle "Notificações" ligado à subscrição real |
| `supabase/notifications_push_v1.sql` | Tabela, RLS, coluna `last_sent_at`, agendamento pg_cron |
| `supabase/functions/send-reminders/index.ts` | Edge Function que envia os pushes |

## Passos de configuração (uma vez)

### 1. Chaves VAPID
Já há um par gerado (commitado só a **pública**). Para gerar um novo:
```bash
npx web-push generate-vapid-keys
```

### 2. Variáveis no Vercel (Frontend)
Em Vercel → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY = <chave pública VAPID>
```
Já está também em `.env.local.example` para dev local. Depois redeploy.

### 3. Secrets da Edge Function (Supabase)
Supabase → Edge Functions → **Manage secrets**:
```
VAPID_PUBLIC_KEY   = <chave pública VAPID>
VAPID_PRIVATE_KEY  = <chave privada VAPID>   ← secreta, nunca commitar
VAPID_SUBJECT      = mailto:igorromualdo.c@gmail.com
CRON_SECRET        = <segredo partilhado com o cron>
REMINDER_TZ        = America/Sao_Paulo        ← fuso usado para casar a hora
```
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente.

### 4. Deploy da Edge Function
```bash
supabase functions deploy send-reminders --no-verify-jwt
```
(`--no-verify-jwt` porque a chamada vem do pg_cron, autenticada pelo
`x-cron-secret`, não por um JWT de utilizador.)

### 5. Migração + agendamento
Editar `supabase/notifications_push_v1.sql`, substituir `<PROJECT_REF>` e
`<CRON_SECRET>` (igual ao do passo 3) e correr no SQL Editor do Supabase.

Para re-agendar com valores diferentes:
```sql
select cron.unschedule('nexus-send-reminders');
```

## Testar
1. Abrir a app em produção (HTTPS), Perfil → ligar **Notificações** (aceitar a
   permissão). Confirmar uma linha nova em `push_subscriptions`.
2. Criar um lembrete em `/lembretes` para daqui a ~2 min, no dia de hoje.
3. Esperar o minuto. Deve chegar a notificação.
4. Debug: Supabase → Edge Functions → Logs da `send-reminders` (mostra
   `{ due, sent }`); `select * from cron.job_run_details order by start_time desc`.

## Notas
- Cada dispositivo/navegador gera a sua própria subscrição (várias linhas por user, ok).
- Subscrições mortas (HTTP 404/410) são apagadas automaticamente no envio.
- **Fuso por dispositivo**: cada subscrição guarda `timezone` (ex.: `Europe/Lisbon`),
  capturado do browser. A função dispara na hora local de cada utilizador.
  `REMINDER_TZ` é apenas fallback para subscrições antigas sem fuso.
