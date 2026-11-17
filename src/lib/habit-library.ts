import type { HabitArea } from '@/types'
import type { CatalogDifficulty } from '@/lib/habit-catalog'
import { XP_BY_DIFFICULTY } from '@/lib/habit-catalog'

/**
 * Biblioteca de hábitos para NAVEGAR e ADICIONAR manualmente (ecrã "Biblioteca"
 * em /habitos). É um superconjunto curado, separado do HABIT_CATALOG usado pelo
 * gerador de onboarding — assim podemos expandir a biblioteca à vontade sem
 * alterar o conjunto que o questionário produz.
 *
 * Cada item tem uma `key` estável (prefixo `lib_`). O ícone mostrado é o da
 * área (AREA_META), para a biblioteca ter um visual consistente.
 */

export interface LibraryHabit {
  key: string
  area: HabitArea
  name: string
  difficulty: CatalogDifficulty
  time_window: string | null
}

/** XP por dificuldade — reutiliza a convenção do catálogo. */
export { XP_BY_DIFFICULTY }

export const LIBRARY_BY_AREA: Record<HabitArea, LibraryHabit[]> = {
  corpo: [
    { key: 'lib_corpo_agua', area: 'corpo', name: 'Beber 2L de água', difficulty: 1, time_window: 'Todo o dia' },
    { key: 'lib_corpo_passos', area: 'corpo', name: '10 000 passos', difficulty: 1, time_window: 'Todo o dia' },
    { key: 'lib_corpo_caminhada', area: 'corpo', name: 'Caminhada de 20 min', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_corpo_along', area: 'corpo', name: 'Alongamento + mobilidade', difficulty: 2, time_window: 'Fim do dia' },
    { key: 'lib_corpo_treino', area: 'corpo', name: 'Treino completo', difficulty: 3, time_window: '07:00-08:30' },
    { key: 'lib_corpo_corrida', area: 'corpo', name: 'Corrida', difficulty: 3, time_window: 'Manhã' },
    { key: 'lib_corpo_yoga', area: 'corpo', name: 'Sessão de yoga', difficulty: 2, time_window: 'Manhã' },
    { key: 'lib_corpo_frio', area: 'corpo', name: 'Banho frio', difficulty: 2, time_window: 'Manhã' },
    { key: 'lib_corpo_refeicao', area: 'corpo', name: 'Refeição saudável', difficulty: 1, time_window: 'Almoço' },
    { key: 'lib_corpo_fruta', area: 'corpo', name: 'Comer fruta', difficulty: 1, time_window: 'Todo o dia' },
    { key: 'lib_corpo_vitaminas', area: 'corpo', name: 'Tomar vitaminas', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_corpo_dentes', area: 'corpo', name: 'Escovar os dentes', difficulty: 1, time_window: 'Manhã e noite' },
    { key: 'lib_corpo_pele', area: 'corpo', name: 'Cuidados com a pele', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_corpo_sono', area: 'corpo', name: 'Dormir 8 horas', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_corpo_cedo', area: 'corpo', name: 'Acordar cedo', difficulty: 2, time_window: 'Manhã' },
    { key: 'lib_corpo_escadas', area: 'corpo', name: 'Subir escadas', difficulty: 1, time_window: 'Todo o dia' },
    { key: 'lib_corpo_peso', area: 'corpo', name: 'Registar o peso', difficulty: 1, time_window: 'Manhã' },
  ],
  produtividade: [
    { key: 'lib_prod_planeardia', area: 'produtividade', name: 'Planear o dia (5 min)', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_prod_amanha', area: 'produtividade', name: 'Planear o amanhã', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_prod_2min', area: 'produtividade', name: 'Regra dos 2 minutos', difficulty: 1, time_window: 'Qualquer hora' },
    { key: 'lib_prod_foco50', area: 'produtividade', name: 'Bloco de foco 50 min', difficulty: 2, time_window: 'Manhã' },
    { key: 'lib_prod_pomodoro', area: 'produtividade', name: 'Sessão Pomodoro', difficulty: 2, time_window: 'Tarde' },
    { key: 'lib_prod_tarefaprinc', area: 'produtividade', name: 'Fechar a tarefa principal do dia', difficulty: 3, time_window: 'Tarde' },
    { key: 'lib_prod_inbox', area: 'produtividade', name: 'Limpar a caixa de entrada', difficulty: 1, time_window: 'Fim do dia' },
    { key: 'lib_prod_objetivos', area: 'produtividade', name: 'Definir objetivos diários', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_prod_revisao', area: 'produtividade', name: 'Revisão semanal', difficulty: 2, time_window: 'Domingo' },
    { key: 'lib_prod_cama', area: 'produtividade', name: 'Fazer a cama', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_prod_secretaria', area: 'produtividade', name: 'Arrumar a secretária', difficulty: 1, time_window: 'Fim do dia' },
    { key: 'lib_prod_semredes', area: 'produtividade', name: 'Manhã sem redes sociais', difficulty: 2, time_window: 'Manhã' },
  ],
  idiomas: [
    { key: 'lib_idio_licao', area: 'idiomas', name: 'Lição de idioma 15 min', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_idio_revisao', area: 'idiomas', name: 'Revisão de vocabulário', difficulty: 2, time_window: 'Almoço' },
    { key: 'lib_idio_conversa', area: 'idiomas', name: 'Conversação 30 min', difficulty: 3, time_window: 'Noite' },
    { key: 'lib_idio_podcast', area: 'idiomas', name: 'Ouvir um podcast', difficulty: 1, time_window: 'Todo o dia' },
    { key: 'lib_idio_livro', area: 'idiomas', name: 'Ler um livro', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_idio_curso', area: 'idiomas', name: 'Curso online', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_idio_documentario', area: 'idiomas', name: 'Ver um documentário', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_idio_instrumento', area: 'idiomas', name: 'Tocar instrumento', difficulty: 2, time_window: 'Tarde' },
    { key: 'lib_idio_aprender', area: 'idiomas', name: 'Aprender algo novo', difficulty: 1, time_window: 'Qualquer hora' },
  ],
  carreira: [
    { key: 'lib_carr_cv', area: 'carreira', name: 'Atualizar CV ou LinkedIn', difficulty: 1, time_window: 'Fim do dia' },
    { key: 'lib_carr_leitura', area: 'carreira', name: 'Leitura técnica 20 min', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_carr_projeto', area: 'carreira', name: 'Avançar projeto / portfólio', difficulty: 3, time_window: 'Tarde' },
    { key: 'lib_carr_codigo', area: 'carreira', name: 'Praticar código', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_carr_network', area: 'carreira', name: 'Networking / contacto novo', difficulty: 2, time_window: 'Tarde' },
    { key: 'lib_carr_curso', area: 'carreira', name: 'Formação / certificação', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_carr_sideproject', area: 'carreira', name: 'Trabalhar no projeto paralelo', difficulty: 3, time_window: 'Noite' },
    { key: 'lib_carr_escrever', area: 'carreira', name: 'Escrita criativa', difficulty: 2, time_window: 'Manhã' },
  ],
  financas: [
    { key: 'lib_fin_registar', area: 'financas', name: 'Registar gastos do dia', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_fin_orcamento', area: 'financas', name: 'Rever o orçamento', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_fin_revisao', area: 'financas', name: 'Revisão semanal de contas', difficulty: 2, time_window: 'Domingo' },
    { key: 'lib_fin_poupar', area: 'financas', name: 'Poupar uma quantia', difficulty: 1, time_window: 'Qualquer hora' },
    { key: 'lib_fin_semcompras', area: 'financas', name: 'Dia sem compras supérfluas', difficulty: 2, time_window: 'Todo o dia' },
    { key: 'lib_fin_investir', area: 'financas', name: 'Estudo de investimento', difficulty: 3, time_window: 'Noite' },
    { key: 'lib_fin_marmita', area: 'financas', name: 'Levar marmita', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_fin_contas', area: 'financas', name: 'Pagar contas a tempo', difficulty: 1, time_window: 'Qualquer hora' },
  ],
  emocoes: [
    { key: 'lib_emo_respiracao', area: 'emocoes', name: 'Respiração guiada 5 min', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_emo_meditacao', area: 'emocoes', name: 'Meditação 20 min', difficulty: 3, time_window: 'Fim do dia' },
    { key: 'lib_emo_journaling', area: 'emocoes', name: 'Journaling emocional', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_emo_gratidao', area: 'emocoes', name: 'Gratidão (3 coisas)', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_emo_vitoria', area: 'emocoes', name: '1 vitória do dia', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_emo_afirmacoes', area: 'emocoes', name: 'Afirmações matinais', difficulty: 1, time_window: 'Manhã' },
    { key: 'lib_emo_refletir', area: 'emocoes', name: 'Refletir sobre o dia', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_emo_natureza', area: 'emocoes', name: 'Tempo ao ar livre', difficulty: 1, time_window: 'Tarde' },
    { key: 'lib_emo_semtela', area: 'emocoes', name: 'Noite sem ecrãs', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_emo_musica', area: 'emocoes', name: 'Ouvir música que gosto', difficulty: 1, time_window: 'Qualquer hora' },
  ],
  relacionamentos: [
    { key: 'lib_rel_mensagem', area: 'relacionamentos', name: 'Mensagem a alguém importante', difficulty: 1, time_window: 'Tarde' },
    { key: 'lib_rel_chamada', area: 'relacionamentos', name: 'Chamada de 15 min', difficulty: 2, time_window: 'Noite' },
    { key: 'lib_rel_pais', area: 'relacionamentos', name: 'Ligar para os pais', difficulty: 1, time_window: 'Noite' },
    { key: 'lib_rel_qualidade', area: 'relacionamentos', name: 'Tempo de qualidade sem telemóvel', difficulty: 3, time_window: 'Jantar' },
    { key: 'lib_rel_elogio', area: 'relacionamentos', name: 'Fazer um elogio', difficulty: 1, time_window: 'Qualquer hora' },
    { key: 'lib_rel_gentileza', area: 'relacionamentos', name: 'Ato de gentileza', difficulty: 1, time_window: 'Qualquer hora' },
    { key: 'lib_rel_conversa', area: 'relacionamentos', name: 'Iniciar uma conversa', difficulty: 2, time_window: 'Qualquer hora' },
    { key: 'lib_rel_abraco', area: 'relacionamentos', name: 'Dar um abraço a alguém', difficulty: 1, time_window: 'Qualquer hora' },
    { key: 'lib_rel_social', area: 'relacionamentos', name: 'Sair com amigos', difficulty: 2, time_window: 'Tarde' },
  ],
}

/** Lista achatada de toda a biblioteca, útil para busca. */
export const LIBRARY_ALL: LibraryHabit[] = Object.values(LIBRARY_BY_AREA).flat()

/** Normaliza texto para busca (remove acentos, minúsculas). */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Filtra a biblioteca por termo de busca (nome). */
export function searchLibrary(query: string): LibraryHabit[] {
  const q = normalizeForSearch(query)
  if (!q) return LIBRARY_ALL
  return LIBRARY_ALL.filter((h) => normalizeForSearch(h.name).includes(q))
}
