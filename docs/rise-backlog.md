# Rise Backlog

## Como ler
- `P0`: bloqueia a espinha dorsal do produto
- `P1`: alto impacto, mas depende da base pronta
- `P2`: importante para enriquecimento
- `P3`: desejavel ou exploratorio

## Epic 1. Foundations e schema

- `P0` Criar migrations para `user_assessments`, `life_area_scores`, `programs`, `program_weeks`, `program_days`, `program_tasks`.
- `P0` Criar tipagens TypeScript dos novos modelos em `src/types`.
- `P0` Criar funcoes de acesso em `src/lib/supabase.ts` ou extrair adaptadores por dominio.
- `P1` Criar seeds de conteudo minimo para academia de habitos.
- `P1` Criar estrategia de storage para posts, avatares e anexos.

## Epic 2. Onboarding diagnostico v2

- `P0` Mapear questionario completo com base nas telas observadas.
- `P0` Implementar fluxo de perguntas multipasso com rascunho local.
- `P0` Suportar tipos de pergunta: unica escolha, multipla escolha, texto livre, escala.
- `P0` Persistir respostas finais no banco.
- `P0` Calcular score inicial e scores por area da vida.
- `P1` Gerar tela de resumo com mapa da vida.
- `P1` Gerar narrativa personalizada de "sua situacao atual".
- `P2` Adicionar prova social e explicacoes cientificas como etapa de conversao.

## Epic 3. Motor do programa de 66 dias

- `P0` Definir catalogo inicial de templates de tarefas.
- `P0` Criar algoritmo que transforma assessment em semana 1.
- `P0` Gerar 66 dias completos com progressao leve.
- `P0` Persistir semanas, dias e tarefas.
- `P0` Permitir ajuste de frequencia, dificuldade e horario.
- `P1` Permitir remover, editar e substituir tarefa.
- `P1` Criar visualizacao por semana e dia.
- `P2` Regerar semanas futuras sem perder historico executado.

## Epic 4. Home / Hoje

- `P0` Refatorar `/hoje` para consumir `program_tasks`.
- `P0` Mostrar contadores de tarefas, concluidos e pulados.
- `P0` Permitir concluir, pular e abrir detalhe da tarefa.
- `P0` Adicionar CTA de criar tarefa manual.
- `P1` Inserir cards visuais com capa por categoria.
- `P1` Exibir banner contextual da academia/ferramentas.
- `P2` Adicionar resumo do dia com texto gerado a partir dos eventos.

## Epic 5. Score, XP e gamificacao

- `P0` Criar ledger `xp_events` para rastrear origem dos pontos.
- `P0` Recalcular XP a partir de eventos do programa.
- `P0` Criar snapshots de score por area e score global.
- `P1` Exibir score inicial vs score atual.
- `P1` Exibir ligas/trofeus com copy alinhada ao produto.
- `P1` Criar badges por consistencia, licoes concluidas e marcos do programa.
- `P2` Adicionar comparativos percentuais e rankings mais ricos.

## Epic 6. Academia de habitos

- `P0` Modelar trilhas, licoes e progresso do usuario.
- `P0` Criar tela de trilha vertical com bloqueios.
- `P0` Criar tela de licao com resumo, ponto-chave e CTA.
- `P1` Permitir anexar uma licao a uma tarefa existente.
- `P1` Liberar novas licoes por progresso.
- `P2` Adicionar mini quiz e certificados.

## Epic 7. Ferramentas

- `P1` Criar hub `/ferramentas` com catalogo modular.
- `P1` Entregar `pomodoro` e `respiracao guiada` como primeiras ferramentas web-friendly.
- `P1` Registrar sessoes de uso em `tool_sessions`.
- `P2` Implementar meditacao guiada com audio.
- `P2` Implementar contador de treinos/calorias.
- `P3` Explorar bloqueador de tela/alarme com limitacoes de browser claramente assumidas.

## Epic 8. Social

- `P1` Modelar posts, reacoes, comentarios e follows.
- `P1` Criar feed com abas `publico`, `amigos` e `meus`.
- `P1` Criar composer com imagem + texto + contexto de tarefa.
- `P2` Adicionar notificacoes sociais.
- `P2` Criar perfis publicos.
- `P3` Moderacao basica e denuncias.

## Epic 9. Billing e premium

- `P1` Integrar Stripe Checkout.
- `P1` Criar `subscriptions` e webhook de sincronizacao.
- `P1` Criar paywall de free trial.
- `P1` Criar lembretes de fim do trial.
- `P2` Criar gating por recurso.
- `P2` Criar tela de boas-vindas pro e CTA para Discord.

## Epic 10. Design system e experiencia

- `P0` Consolidar tokens visuais alinhados as referencias do Rise.
- `P0` Padronizar cards, chips, botoes e barras de progresso.
- `P1` Criar biblioteca de capas/imagens por categoria.
- `P1` Melhorar transicoes entre onboarding, analise e programa.
- `P2` Polir responsividade desktop/tablet.

## Tarefas transversais

- `P0` Definir criterios de geracao do score.
- `P0` Definir estrategia de feature flags para modulos incompletos.
- `P1` Adicionar eventos de analytics.
- `P1` Adicionar smoke tests dos fluxos principais.
- `P2` Criar painel administrativo simples para seeds e conteudo.

## Backlog sugerido para o proximo sprint
- `P0` migrations do programa e assessment
- `P0` onboarding v2 com persistencia
- `P0` calculo de score inicial
- `P0` geracao da semana 1
- `P0` refactor de `/hoje` para tarefas do programa
- `P1` visualizacao de calendario/semana

## Backlog sugerido para o sprint seguinte
- `P0` completar 66 dias e snapshots
- `P1` academia de habitos basica
- `P1` paywall/trial
- `P1` polimento de gamificacao
