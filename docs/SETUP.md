# NEXUS — Setup & Desenvolvimento

## Requisitos

- **Node.js** 18.17+ (recomendado 20 LTS+)
- **npm** (gestor do projeto — `package-lock.json`)
- Um projeto **Supabase** (URL + anon/publishable key)

## 1. Instalar dependências

```bash
npm install
```

## 2. Variáveis de ambiente

```bash
cp .env.local.example .env.local
# preencher com os valores do teu projeto Supabase
```

| Variável | Obrigatória | Finalidade |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anon/publishable (pública, protegida por RLS) |

Encontras os valores em **Supabase Dashboard → Project Settings → API**.

> São variáveis `NEXT_PUBLIC_*` → embutidas no bundle em **build time**. Em
> produção (Vercel), define-as nas Environment Variables **antes** do deploy.
> Nunca commites `.env.local` nem valores reais no `.env.local.example`.

## 3. Base de dados (Supabase)

Aplica os scripts SQL em `supabase/` no SQL Editor do Supabase, pela ordem dos
sprints. Notas de auth em `SUPABASE_AUTH_CONFIG.md`.

> ⚠️ **Atenção:** o schema versionado está **incompleto**. O código usa ~28
> tabelas e as funções RPC `add_xp` e `update_streak`, mas só ~13 tabelas têm
> SQL no repo. Um setup limpo **não recria a BD inteira** sem o schema completo
> em falta. Ver `TECHNICAL_DEBT.md`.

## 4. Rodar localmente

```bash
npm run dev      # http://localhost:3001
```

## Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Next dev na porta **3001** |
| `npm run build` | Build de produção (PWA) |
| `npm start` | Serve o build na porta 3001 |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Testes (Vitest, run único) |
| `npm run test:watch` | Testes em watch |

## Build de produção

```bash
npm run build
npm start
```

## Deploy

Alvo provável: **Vercel** (integração Git → deploy automático). Garante as duas
variáveis de ambiente configuradas no projeto Vercel antes do build. Não há CI
nem Dockerfile no repositório.

## Fluxo de contribuição

- Branch principal: `main`.
- Desenvolve numa branch de feature/fix e abre Pull Request contra `main`.
- Antes de abrir PR, garante verde: `npm run lint && npm run typecheck && npm test && npm run build`.
