# NEXUS — HANDOFF RÁPIDO DO ESTADO ATUAL

## Estado atual
O projeto continua em evolução por fases incrementais.

Nesta leva, o foco esteve em:
- `Corpo` — importação e tratamento de treino/dieta
- `Hábitos` — regressão visual de ícone
- ambiente local — porta de desenvolvimento

---

## O que foi ajustado agora

### 1. Página Corpo
Ficheiros principais:
- `src/app/corpo/page.tsx`
- `src/lib/body-plan.ts`

O que foi feito:
- leitura de planos antigos com fallback a partir de `raw_content`
- parsing de treino para `PDF`, `XLSX`, `XLS` e `CSV`
- parsing de dieta para `PDF`, `XLSX`, `XLS` e `CSV`
- estrutura por:
  - secções/blocos
  - exercícios
  - refeições
  - itens de refeição
- persistência de:
  - check por exercício
  - carga
  - observação rápida
  - check por item de refeição

### 2. Página Hábitos
Ficheiros principais:
- `src/components/Nav.tsx`
- `src/components/Sidebar.tsx`

O que foi feito:
- ícone de `Hábitos` foi restaurado para um estilo de checklist/clipboard
- `Nav` e `Sidebar` ficaram sincronizados

### 3. Ambiente local
Ficheiro principal:
- `package.json`

O que foi feito:
- `npm run dev` agora usa porta `3001`
- `npm start` também usa porta `3001`

URL local esperada:
- `http://localhost:3001`

---

## Problema principal ainda em aberto

### Corpo ainda pode continuar “bagunçado”
Apesar da melhoria do parser, o tratamento ainda depende muito do formato real do ficheiro importado.

Sintomas já vistos:
- linhas técnicas a serem lidas como exercício
- cabeçalhos e siglas a virarem itens
- blocos de treino pouco limpos

Conclusão:
- o parser ficou melhor
- mas ainda precisa ser calibrado com ficheiros reais do utilizador

---

## O que validar agora

### Corpo
Testar nesta ordem:
1. abrir `http://localhost:3001`
2. ir para `Corpo`
3. importar uma planilha real
4. importar um PDF real
5. verificar se aparecem:
   - secções corretas
   - exercícios corretos
   - detalhes úteis
6. marcar exercícios
7. guardar carga
8. guardar observação
9. abrir `Dieta`
10. verificar refeições e itens

### Hábitos
Confirmar:
1. ícone restaurado no menu inferior
2. ícone restaurado na sidebar desktop

---

## Build / verificação técnica
Validação já feita:
- `npx tsc --noEmit` passou

Nota:
- `npm run build` já bateu antes em `EPERM` no `.next\\trace` em Windows/sandbox
- isso parece ser problema de ambiente, não erro de TypeScript

---

## Próximo passo recomendado
Não abrir nova fase ampla ainda.

Fazer nesta ordem:
1. testar `Corpo` com ficheiros reais
2. ajustar parser com base no formato exato da planilha/PDF
3. só depois polir UX de treino/dieta

---

## Regra importante relembrada
O utilizador pediu para:
- não alterar visuais sem necessidade
- não trocar ícones/identidade visual sem pedido explícito
- manter `Nav.tsx` e `Sidebar.tsx` sincronizados quando houver mudança de navegação

---

## Resumo curto
O projeto agora roda localmente em `3001`, o ícone de `Hábitos` foi restaurado, e `Corpo` ganhou tratamento inicial para `PDF` e planilhas.

O próximo bloqueio real não é mais a aceitação do ficheiro, e sim a qualidade do parsing com os ficheiros concretos do utilizador.
