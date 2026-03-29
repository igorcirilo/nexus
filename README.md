# NEXUS — Sistema de Evolução Pessoal
> PWA de alta performance · Next.js 14 · Supabase · Tailwind · Vercel

---

## Instalar e correr em 5 passos

### Pré-requisitos
- Node.js 18+ instalado ([nodejs.org](https://nodejs.org))
- Conta gratuita no [Supabase](https://supabase.com)
- Conta gratuita no [Vercel](https://vercel.com)

---

### PASSO 1 — Configurar o Supabase

1. Vai a [supabase.com](https://supabase.com) → **New Project**
2. Dá um nome ao projeto (ex: `nexus`)
3. Escolhe uma região próxima (ex: `eu-west-1`)
4. No painel do projeto: **SQL Editor → New Query**
5. Cola TODO o conteúdo do ficheiro `supabase/schema.sql`
6. Clica **Run** — o schema está criado

**Copiar as credenciais:**
- Vai a **Project Settings → API**
- Copia o `Project URL` e o `anon public key`

---

### PASSO 2 — Configurar o projeto local

```bash
# 1. Entra na pasta do projeto
cd nexus

# 2. Instala as dependências
npm install

# 3. Cria o ficheiro de variáveis de ambiente
cp .env.local.example .env.local
```

Abre `.env.local` e preenche:
```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
```

---

### PASSO 3 — Correr em modo desenvolvimento

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — deves ver o ecrã de login.

---

### PASSO 4 — Adicionar dados iniciais (hábitos de exemplo)

No Supabase **SQL Editor**, depois de criar o teu utilizador via login:

```sql
-- Substitui 'SEU_USER_ID' pelo teu UUID (visível em Authentication → Users)
INSERT INTO habits (user_id, name, area, xp_reward, time_window) VALUES
  ('SEU_USER_ID', 'Treino físico',   'corpo',         50, '07:00–09:00'),
  ('SEU_USER_ID', 'Idioma — 20 min', 'idiomas',       30, '18:00–19:00'),
  ('SEU_USER_ID', 'Leitura · 15 min','carreira',      20, '21:00–22:00'),
  ('SEU_USER_ID', 'Água · 2L',       'corpo',         25, 'Todo o dia'),
  ('SEU_USER_ID', 'Meditação 10 min','emocoes',       20, '07:30–08:00');
```

---

### PASSO 5 — Deploy na Vercel

```bash
# Instala a CLI da Vercel (uma vez)
npm i -g vercel

# Deploy
vercel

# Segue as instruções. Quando pedir variáveis de ambiente,
# adiciona NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Ou directamente via [vercel.com/new](https://vercel.com/new):
1. Importa o repositório GitHub
2. Em **Environment Variables** adiciona as duas variáveis do `.env.local`
3. Deploy automático

---

### PASSO 6 — Instalar como PWA

**No telemóvel (iOS):**
1. Abre o URL no Safari
2. Toca em **Partilhar** (ícone de caixa com seta)
3. Selecciona **Adicionar ao Ecrã de Início**
4. Confirma — o NEXUS aparece no ecrã como app nativa

**No telemóvel (Android):**
1. Abre no Chrome
2. Aparece automaticamente um banner "Instalar"
3. Ou: Menu (⋮) → **Instalar aplicação**

---

## Estrutura do Projeto

```
nexus/
├── public/
│   └── manifest.json          # Config PWA
├── supabase/
│   └── schema.sql             # Base de dados completa
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Layout raiz + fonts + PWA meta
│   │   ├── globals.css        # Design tokens + componentes CSS
│   │   ├── page.tsx           # Redirect → /hoje
│   │   ├── auth/page.tsx      # Login magic link
│   │   ├── hoje/page.tsx      # Home — tela principal
│   │   ├── checkin/page.tsx   # Check-ins manhã/tarde/noite
│   │   ├── habitos/page.tsx   # Criar, editar e gerir hábitos
│   │   ├── evolucao/page.tsx  # Nível, XP, áreas, badges
│   │   └── dashboard/page.tsx # Gráficos e métricas
│   ├── components/
│   │   ├── Nav.tsx            # Navegação inferior
│   │   ├── XPBar.tsx          # Barra de XP + nível
│   │   ├── MissionCard.tsx    # Missão + Pomodoro
│   │   ├── HabitItem.tsx      # Item de hábito com toggle
│   │   ├── MentorCard.tsx     # Card do mentor
│   │   └── XPToast.tsx        # Notificações de XP
│   ├── lib/
│   │   ├── supabase.ts        # Cliente + todas as queries
│   │   └── mentor.ts          # Lógica condicional do mentor
│   └── types/index.ts         # TypeScript + helpers XP/nível
```

---

## Stack Técnica

| Camada       | Tecnologia                          |
|--------------|-------------------------------------|
| Framework    | Next.js 14 (App Router)             |
| Styling      | Tailwind CSS                        |
| Gráficos     | Recharts                            |
| Base de dados| Supabase (PostgreSQL + Auth + RLS)  |
| PWA          | next-pwa                            |
| Hosting      | Vercel                              |
| Auth         | Magic Link (sem password)           |
| Datas        | date-fns                            |

---

## Roadmap

### V2 (após validação)
- [ ] Mentor com IA real (Claude API)
- [ ] Objectivos de 90 dias com timeline visual
- [ ] Radar chart das áreas da vida
- [ ] Notificações push (check-in reminder às 21h)
- [ ] Avatar evolutivo por nível
- [ ] Modo de recuperação após streak quebrado
- [ ] Módulo de finanças detalhado

### V3
- [ ] IA adaptativa — lê padrões de energia/humor
- [ ] Previsão de risco de quebra de hábito
- [ ] Coach conversacional
- [ ] Exportação de relatório PDF mensal
- [ ] Partilha de streak com amigos

---

## Sistema de XP e Níveis

| Nível | Título       | XP necessário |
|-------|-------------|---------------|
| 1–2   | Recruta      | 0–1.500       |
| 3–4   | Consistente  | 1.500–5.000   |
| 5–7   | Focado       | 5.000–14.000  |
| 8–10  | Estrategista | 14.000–27.500 |
| 11–14 | Imparável    | 27.500–52.500 |
| 15+   | Antifrágil   | 52.500+       |

**XP por acção:**
- Hábito concluído: 20–50 XP (depende do hábito)
- Check-in manhã: 80 XP
- Check-in tarde: 60 XP
- Check-in noite: 100 XP
- Sessão Pomodoro (25 min): 30 XP
- Badge desbloqueado: 50–2.000 XP

---

## Notas de Segurança

- Row Level Security (RLS) activado em todas as tabelas
- Cada utilizador só acede aos próprios dados
- Auth via magic link — sem passwords armazenadas
- Chaves do Supabase são públicas (anon key) — seguro para frontend
