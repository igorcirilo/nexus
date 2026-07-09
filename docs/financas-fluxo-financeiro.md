# Finanças — Fluxo financeiro consistente (poupança, reserva, saldos)

> Documento de produto + engenharia. Define os conceitos, as regras de negócio,
> as fórmulas e o modelo de dados do fluxo financeiro do Nexus, e regista o
> diagnóstico das incoerências que existiam até à migração
> `financas_reserva_v1.sql`. Serve de referência para qualquer alteração futura
> na área /financas.

---

## 1. Diagnóstico das incoerências (estado anterior)

O sintoma reportado — *"quando adiciono à poupança o valor entra na reserva;
quando retiro, sai da poupança mas não sai da reserva"* — não era um `if` em
falta. Era consequência estrutural de a reserva ser **um número armazenado
(`profiles.fin_current_savings`) atualizado incrementalmente** a partir de
múltiplos pontos do código, em vez de derivar da poupança vinculada.

Causas concretas encontradas:

1. **Escrita incremental em 8 sítios diferentes** — adicionar, editar, apagar,
   lançar recorrência, importar CSV, importar PDF (em /financas), registo
   rápido (QuickAction) e edição manual. Qualquer caminho que falhasse ou
   ficasse de fora (versões antigas, erros silenciosos de rede) fazia a cópia
   divergir dos movimentos — e a divergência era permanente, porque nada a
   reconciliava.
2. **Convenção invertida a meio do histórico** — o commit `583ee74` tratava
   *entrada + Poupança* como levantamento; o commit `0b21f5c` inverteu para a
   convenção atual (*entrada = depositar, saída = levantar*). Movimentos
   registados na convenção antiga passaram a ser interpretados ao contrário,
   e builds publicados entre os dois commits só somavam depósitos — o cenário
   exato do bug reportado.
3. **Clamp assimétrico `Math.max(0, …)`** — depósitos somavam sempre;
   levantamentos que levariam a reserva abaixo de zero eram truncados. A cada
   truncagem perdia-se registo: depositar 100 e levantar 100 podia deixar a
   reserva maior do que começou.
4. **Overwrite silencioso no perfil** — o formulário de /perfil carregava
   `fin_current_savings` num snapshot ao abrir a página e gravava-o de volta
   ao "Guardar" (sem sequer ter um input para o campo). Registar depósitos em
   /financas e depois guardar o perfil revertia a reserva para o valor antigo.
5. **Duas fontes de verdade para "quanto poupei"** — corrigido na primeira
   ronda ([commit 641dcd1]): o insight e o histórico de poupança usavam
   "o que sobrou" (entradas − saídas) enquanto o cartão Poupado e a meta usavam
   as transferências reais para a reserva.

**Correção estrutural aplicada:** a reserva deixou de ser um saldo armazenado
e passou a ser **derivada** (secção 4). Todos os escritores incrementais foram
removidos; deixou de existir estado para divergir.

---

## 2. Conceitos e definições

O Nexus modela uma **conta corrente implícita** (o dinheiro do dia a dia) e uma
**conta poupança implícita** (a reserva), ligadas pela categoria reservada
`Poupança`. Não há múltiplas contas nomeadas — mas os conceitos são os mesmos
de qualquer app de finanças pessoais:

| Conceito | Definição no Nexus | Onde aparece |
|---|---|---|
| **Receita** | Entrada real de dinheiro vinda de fora (`entrada`, categoria ≠ Poupança) | "Entradas" no hero |
| **Despesa** | Saída real para terceiros (`saida`, categoria ≠ Poupança) | "Gastos" no hero, orçamento |
| **Transferência interna** | Movimento com categoria `Poupança`: `entrada` = depositar na reserva, `saida` = levantar da reserva. **Não é receita nem despesa** | Cartão "🏦 Poupado", rotulada "depósito/levantamento da reserva" nas listas |
| **Poupança (conta)** | O sítio onde o dinheiro guardado vive. Saldo = base + Σ movimentos de Poupança | Cartão "🛡️ Reserva" |
| **Reserva de emergência (meta)** | Objetivo (`fin_reserve_goal`) **vinculado** à conta poupança: o progresso é o saldo da poupança, nunca um número próprio | Anel de progresso do cartão Reserva |
| **Alocação** | Meta mensal de poupança (`fin_monthly_save`): quanto quero transferir por mês. Medida contra as transferências reais do mês | Cartão "💰 Poupança · mês" |
| **Saldo do mês (balanço)** | Receitas − despesas do mês corrente (transferências fora) | Hero "Balanço do mês" |
| **Saldo disponível** | Dinheiro livre na conta corrente agora: o que arrastou de meses anteriores + balanço do mês − o que já moveu para a poupança este mês | Linha "Começaste … · disponível …" |

A regra de ouro: **transferir para a poupança não te torna mais pobre nem mais
rico** — o balanço (receita − despesa) não mexe; o *disponível* desce e a
*reserva* sobe pelo mesmo valor. Levantar é o espelho exato.

---

## 3. Regras de negócio

1. **Toda a movimentação tem um tipo efetivo**: receita, despesa ou
   transferência interna. O tipo efetivo deriva de (`type`, `category`):
   categoria `Poupança` ⇒ transferência; caso contrário `entrada` ⇒ receita e
   `saida` ⇒ despesa.
2. **Transferências têm origem e destino implícitos**: conta corrente ↔
   poupança. `entrada + Poupança` = corrente → poupança; `saida + Poupança` =
   poupança → corrente. (Com múltiplas contas, isto generaliza para
   `from_account_id`/`to_account_id` — ver secção 7.)
3. **A reserva é derivada, nunca editada por movimento**:
   `reserva = fin_savings_base + Σ(depósitos) − Σ(levantamentos)` sobre TODO o
   histórico. Adicionar, editar, apagar ou importar movimentos reflete-se
   automaticamente — não existe código que "empurre" a reserva.
4. **Ajuste manual é ajuste de base, com regra clara**: quando o utilizador
   escreve "tenho X guardado", a app grava
   `fin_savings_base = X − Σ líquido dos movimentos`. Os movimentos nunca são
   reescritos; a base representa dinheiro poupado *fora* do histórico
   registado (saldo inicial, juros, contas externas).
5. **Zerar a poupança zera a reserva**: como a reserva É o saldo da poupança,
   não há divergência possível entre as duas. (Item 3 do briefing: garantido
   por construção, não por sincronização.)
6. **Transferências ficam fora de tudo o que mede consumo/rendimento**:
   entradas, gastos, balanço, orçamento (gauge, sugestões, médias, sparkline),
   "para onde foi o dinheiro", deteção de anomalias e comparações mensais.
7. **A meta vinculada não pode divergir do saldo real**: o anel da reserva
   mostra `min(100%, max(0%, reserva/objetivo))`. `fin_reserve_goal` é o único
   número "planeado"; o acumulado é sempre real.
8. **Só a conta corrente conta para o disponível**: o dinheiro na poupança não
   aparece como disponível (foi separado de propósito); volta a aparecer
   quando há um levantamento.
9. **O saldo do mês tem uma única fórmula documentada** (secção 4) e é o mesmo
   número em /financas e no cartão de finanças da página Hoje.

---

## 4. Fórmulas (fonte única)

Com `T` = todas as transações, `P` = transações com categoria `Poupança`,
`mês` = mês corrente:

```
receitas(mês)     = Σ amount   T: type=entrada, cat≠Poupança, date∈mês
despesas(mês)     = Σ amount   T: type=saida,   cat≠Poupança, date∈mês
poupado(mês)      = Σ amount   P: type=entrada, date∈mês
                  − Σ amount   P: type=saida,   date∈mês        (pode ser <0)

balanço(mês)      = receitas(mês) − despesas(mês)                ["saldo do mês"]

líquidoPoupança   = Σ amount P:entrada − Σ amount P:saida        (todo o histórico)
reserva           = fin_savings_base + líquidoPoupança           [saldo da poupança]

arrastado(mês)    = Σ fluxo de caixa da conta corrente antes do dia 1:
                    entradas − saídas normais, com Poupança invertida
                    (depósito tira da corrente; levantamento devolve)  [carryIn]

disponível        = arrastado(mês) + balanço(mês) − poupado(mês)
```

Invariante de consistência (vale para qualquer sequência de operações):

```
Δdisponível + Δreserva = receitas − despesas
```

— transferências movem dinheiro entre os dois lados sem criar nem destruir;
só receitas e despesas alteram o total.

---

## 5. Fluxos práticos

| # | Ação do utilizador | Registo | Efeitos |
|---|---|---|---|
| 1 | Recebe salário 1000 | `entrada · Salário · 1000` | balanço +1000, disponível +1000; reserva inalterada |
| 2 | Transfere 200 para a poupança | `entrada · Poupança · 200` | reserva +200, poupado(mês) +200, disponível −200; **balanço, entradas e gastos inalterados** |
| 3 | Vincula a poupança à reserva | define `fin_reserve_goal` (e opcionalmente ajusta o acumulado → base) | anel passa a mostrar reserva/objetivo, derivado |
| 4 | Retira 50 da poupança | `saida · Poupança · 50` | reserva −50, poupado(mês) −50, disponível +50; balanço inalterado |
| 5 | Usa a reserva numa emergência (400 no dentista) | dois registos: `saida · Poupança · 400` (levantar) + `saida · Saúde · 400` (gastar) | reserva −400; despesa aparece em Saúde (o gasto real), não em Poupança |
| 6 | Move entre corrente/poupança/investimento | hoje: Poupança cobre o par corrente↔reserva; Investimento é categoria de saída (consumo de capital) — ver evolução na secção 7 |
| 7 | Edita/apaga um movimento antigo de Poupança | update/delete na transação | a reserva recalcula sozinha — não há passo extra que possa ser esquecido |
| 8 | Corrige o total da reserva à mão | escreve X no cartão | `base = X − líquido`; movimentos intactos, ajuste rastreável na base |

O fluxo 5 merece destaque de produto: uma emergência são **duas verdades** —
o dinheiro saiu da reserva (transferência) e foi gasto em algo (despesa). Se
fosse um só registo, ou o gasto não apareceria nos relatórios, ou a reserva
não desceria.

---

## 6. Modelo de dados

### Atual (após `financas_reserva_v1.sql`)

```
transactions                       profiles (campos financeiros)
├─ id, user_id                     ├─ fin_savings_base    ← poupança fora do
├─ date                            │    histórico (inicial + ajustes manuais)
├─ type: entrada|saida             ├─ fin_reserve_goal    ← meta da reserva
├─ category  ('Poupança' ⇒         ├─ fin_monthly_save    ← alocação mensal
│   transferência interna)         ├─ fin_budgets (jsonb) ← orçamentos por cat.
├─ amount, description             └─ fin_current_savings ← LEGADA (fallback
└─ recurring_id → recurring_rules       pré-migração; não é mais escrita)
```

- **Derivados (nunca armazenados):** reserva, balanço, disponível, poupado do
  mês, gastos por categoria. Zero risco de dessincronização.
- **Armazenados:** apenas factos (transações) e intenções (metas, base).

### Evolução recomendada (se/quando houver múltiplas contas)

```
accounts(id, user_id, name, kind: corrente|poupanca|investimento,
         include_in_available bool, archived)
transactions(…, account_id)                       -- receita/despesa numa conta
transfers(id, user_id, date, amount,
          from_account_id, to_account_id, note)   -- 1 registo, 2 pernas
goals(id, user_id, name, target_amount,
      linked_account_id nullable)                 -- meta vinculada ⇒ progresso
                                                  --   = saldo da conta (view)
```

Regras que se mantêm: saldo de conta = Σ pernas; meta vinculada deriva;
`disponível = Σ saldos das contas com include_in_available`; transferências
nunca entram em relatórios de receita/despesa. A categoria `Poupança` de hoje
é o caso degenerado disto (2 contas fixas), e a migração de dados é mecânica:
cada transação `Poupança` vira uma linha em `transfers`.

---

## 7. Casos de teste (invariantes)

Automatizados em `src/app/financas/__tests__/page.test.ts` e
`src/lib/__tests__/finance.test.ts`:

1. **Simetria** — depositar 200 e ver a reserva subir; levantar 200 e ver a
   reserva descer o mesmo valor, sem qualquer escrita no perfil
   (`reserva deriva da poupança: depósito entra E levantamento sai`).
2. **Transferência ≠ receita/despesa** — depósito de 150 não aparece nas
   entradas nem infla o balanço (`trata Poupança como transferência`).
3. **Edição/apagamento reconciliam sozinhos** — trocar depósito↔levantamento
   ou apagar não escreve a reserva; ela é refetchada dos movimentos.
4. **Ajuste manual = ajuste de base** — escrever "300" com líquido 150 grava
   `fin_savings_base = 150`; movimentos intactos.
5. **Poupado ≠ sobra** — insight, histórico de poupança e meta mensal medem
   transferências reais, não `receitas − despesas`.
6. **Orçamento ignora transferências** — levantamentos não geram sugestão de
   orçamento nem contam no gauge.
7. **Fallback pré-migração** — sem `fin_savings_base`, mostra o valor legado.

Invariantes manuais úteis em QA exploratório:

- Registar +100 Poupança e −100 Poupança (qualquer ordem) devolve reserva,
  disponível e poupado do mês exatamente ao estado inicial.
- `Δdisponível + Δreserva = receitas − despesas` após qualquer sequência.
- Guardar o perfil nunca altera nenhum número de /financas.

---

## 8. UX — como o utilizador distingue os tipos de movimento

Implementado:

- **Transferências têm cor própria** (dourado, nem verde de receita nem
  vermelho de despesa) e legenda explícita nas listas: *"depósito na reserva"*
  / *"levantamento da reserva"*.
- **Cartão "🏦 Poupado"** separado de Entradas/Gastos no hero, com sublegenda
  ("movido para a reserva" / "levantaste da reserva").
- **Cartão da reserva** explica no sheet: *"A reserva acompanha os teus
  movimentos de Poupança; editar aqui ajusta o que tens guardado fora do
  registo — não altera movimentos."*
- **Balanço rotulado** como "entradas − gastos" para não se confundir com
  disponível; o disponível aparece na linha do saldo arrastado.

Recomendações futuras (por ordem de valor):

1. No formulário, quando a categoria é Poupança, mudar o CTA e os rótulos dos
   tipos para "Depositar na reserva / Levantar da reserva" (em vez de
   entrada/saída) — elimina de vez a ambiguidade de perspetiva.
2. Fluxo guiado "Usar a reserva" que cria os dois registos do fluxo 5
   (levantamento + despesa real) numa ação só.
3. Filtro "Transferências" no sheet de movimentos, ao lado de Entradas/Saídas.
4. Mostrar no cartão da reserva a decomposição "X registado + Y fora do
   registo" quando `fin_savings_base ≠ 0`, para o ajuste manual nunca parecer
   um número mágico.

---

## 9. Migração

Aplicar `supabase/financas_reserva_v1.sql` no SQL editor do Supabase:

1. Cria `profiles.fin_savings_base`.
2. Backfill: `base = fin_current_savings − líquido atual dos movimentos` — o
   valor mostrado a cada utilizador **não muda** no momento da migração; passa
   apenas a ser vivo a partir daí.
3. `fin_current_savings` fica como coluna legada (fallback de leitura para
   builds antigos; nenhum código novo a escreve).

Sem a migração aplicada, a app degrada graciosamente: mostra o valor legado
estático e o ajuste manual continua a gravá-lo como antes.

---

## 10. Categorias de aporte (Emergências / Investimentos)

> Extensão posterior ao documento original. Motivação: o utilizador orçamentava
> "Emergências" e "Investimentos" como categorias personalizadas de saída, mas
> esses movimentos eram tratados como consumo — não mexiam no cartão 🛡️ Reserva
> nem no cartão 💰 Poupança. O orçamento e as metas viviam desligados.

`Emergências` e `Investimentos` passaram a categorias de saída **de raiz**
(`CATEGORIES_OUT`) com semântica de **transferência interna**, tal como
`Poupança` — mas lidas do ponto de vista da CONTA (a convenção intuitiva de
quem regista):

| Movimento | Tipo efetivo (`txKind`) | Conta (`cashFlow`) | Reserva (`reserveFlow`) | Poupado (`savedFlow`) |
|---|---|---|---|---|
| saída `Emergências` | `aporteReserva` | − | + | + |
| entrada `Emergências` | `resgateReserva` | + | − | − |
| saída `Investimentos` | `aporteInvest` | − | 0 | + |
| entrada `Investimentos` | `resgateInvest` | + | 0 | − |

Regras derivadas:

1. **Cartão 🛡️ Reserva**: `getSavingsNet` inclui os movimentos de
   `Emergências` — um aporte de emergência é um depósito na reserva com a
   convenção invertida. Investimentos não entram (não são fundo de emergência).
2. **Cartão 💰 Poupança (meta mensal)**, série "poupado" do gráfico e insights
   de poupança usam `savedFlow` = fluxo-reserva + aportes/resgates de
   investimento: tudo o que pagaste a ti mesmo no mês.
3. **Orçamento**: os aportes enchem o envelope da sua categoria
   (`categoryTotals` com `includeContributions:true` no mapa do gauge). Nos
   mapas de consumo ("para onde foi o dinheiro", anomalias, médias 3m,
   comparação com o mês anterior) ficam de fora — aporte não é gasto.
4. **Rendimento**: um resgate é transferência, não receita — fica fora de
   "Entradas" e do rendimento do mês.
5. **"Pagar com a reserva"** não se aplica a nenhuma categoria de transferência
   (`isTransferCat`).
6. Nas listas, os aportes/resgates ganham a cor dourada e legenda própria
   ("aporte à reserva", "aporte a investimentos", …), como as restantes
   transferências.

Categorias personalizadas antigas com o mesmo nome deixam de ser consideradas
personalizadas (a versão de raiz manda); orçamentos e movimentos existentes
nessas categorias continuam válidos e passam a ter a semântica de aporte.
