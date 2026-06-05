# Nexus

Aplicação web (PWA) de hábitos, treino, dieta, finanças e progresso pessoal,
construída com Next.js (App Router) e Supabase.

## Requisitos

- **Node.js** 18.17+ (recomendado 20 LTS ou superior)
- **npm** (gestor de pacotes do projeto — existe `package-lock.json`)
- Um projeto **Supabase** (URL + anon/publishable key)

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Copia o exemplo e preenche com os teus valores do Supabase:

```bash
cp .env.local.example .env.local
```

Variáveis necessárias (ver `.env.local.example`):

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon/publishable do Supabase |

Encontras estes valores em **Supabase Dashboard → Project Settings → API**.

> O `.env.local.example` contém apenas placeholders — nunca commites valores
> reais nem o `.env.local` (já está no `.gitignore`).
>
> Como são variáveis `NEXT_PUBLIC_*`, são embutidas no bundle em *build time*.
> Em produção (ex.: Vercel) define-as nas Environment Variables **antes** do
> deploy. Sem elas o cliente Supabase usa placeholders e não liga ao backend.

## Rodar localmente

```bash
npm run dev
```

A app fica disponível em http://localhost:3001

## Testes

```bash
npm test          # corre a suite (vitest) uma vez
npm run test:watch
```

## Typecheck

```bash
npm run typecheck
```

## Lint

```bash
npm run lint
```

## Build

```bash
npm run build
npm start          # serve o build de produção na porta 3001
```

## Base de dados (Supabase)

Os scripts SQL de schema/seed estão em `supabase/`. Aplica-os no SQL Editor do
Supabase pela ordem dos sprints. Notas adicionais de auth em
`SUPABASE_AUTH_CONFIG.md`.

## Observações de manutenção

- **Branch principal:** `main`.
- **Fluxo de PR:** desenvolve numa branch de feature/fix e abre Pull Request
  contra `main`.
- O cliente Supabase está centralizado em `src/lib/supabase.ts`.
- Os ficheiros do PWA (`public/sw.js`, `public/workbox-*.js`) são gerados no
  build e estão ignorados no Git.
