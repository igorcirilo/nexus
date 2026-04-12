INSERT INTO task_templates (area, title, description, difficulty, frequency_per_week, xp_reward, tags, active)
VALUES
  -- Dificuldade 2
  ('corpo',           'Treinar 30min',                      'Faça 30 minutos de exercício moderado.',               2, 3, 25, ARRAY['exercicio','corpo'],       true),
  ('corpo',           'Dormir antes das 23h',               'Respeite seu horário de dormir.',                      2, 7, 20, ARRAY['sono','recuperacao'],       true),
  ('corpo',           'Caminhar 20min ao ar livre',         'Uma caminhada rápida para ativar o corpo.',            2, 5, 20, ARRAY['caminhada','saude'],        true),
  ('produtividade',   'Bloco de foco de 60min',             'Trabalhe 60min sem notificações.',                     2, 5, 25, ARRAY['foco','deep-work'],         true),
  ('produtividade',   'Revisar e fechar tarefas pendentes', 'Reserve 20min para limpar pendências do dia.',         2, 5, 20, ARRAY['revisao','organizacao'],    true),
  ('idiomas',         'Praticar idioma 20min',              'Use Duolingo, Anki ou vídeo no idioma-alvo.',          2, 5, 25, ARRAY['idioma','pratica'],         true),
  ('carreira',        'Ler artigo da área',                 'Leia 1 artigo relevante para sua carreira.',           2, 3, 20, ARRAY['leitura','carreira'],       true),
  ('financas',        'Registrar gastos do dia',            'Anote todos os gastos do dia.',                        2, 7, 20, ARRAY['financas','habito'],        true),
  ('emocoes',         'Meditação 10min',                    'Meditação guiada ou respiração consciente.',           2, 5, 25, ARRAY['meditacao','bem-estar'],    true),
  ('relacionamentos', 'Mensagem para alguém próximo',       'Envie uma mensagem genuína para alguém.',              2, 3, 20, ARRAY['conexao','relacionamento'], true),

  -- Dificuldade 3
  ('corpo',           'Treinar 45min com intensidade',           'Treino de alta intensidade ou musculação.',              3, 4, 40, ARRAY['treino','intensidade'],     true),
  ('corpo',           'Protocolo de recuperação',                'Alongamento + hidratação + 10min de descanso ativo.',    3, 3, 30, ARRAY['recuperacao','corpo'],      true),
  ('corpo',           'Treino em jejum ou protocolo nutricional','Exercite-se em jejum ou siga protocolo nutricional.',   3, 3, 35, ARRAY['nutricao','treino'],        true),
  ('produtividade',   'Deep work: 2h sem interrupção',           'Dois blocos de 60min em tarefa de alta prioridade.',     3, 5, 40, ARRAY['deep-work','foco'],        true),
  ('produtividade',   'Revisão semanal (30min)',                 'Avalie a semana e planeje a próxima.',                   3, 1, 40, ARRAY['revisao','planejamento'],   true),
  ('idiomas',         'Conteúdo 30min no idioma-alvo',           'Assista ou ouça algo no idioma-alvo por 30min.',         3, 5, 35, ARRAY['idioma','imersao'],         true),
  ('carreira',        'Projeto pessoal 45min',                   'Trabalhe 45min no seu projeto ou portfólio.',            3, 3, 40, ARRAY['projeto','carreira'],       true),
  ('financas',        'Revisar orçamento e projeção mensal',     'Analise gastos e ajuste projeção do mês.',               3, 1, 40, ARRAY['financas','planejamento'],  true),
  ('emocoes',         'Journaling reflexivo 15min',              'Escreva sobre o dia: aprendizados e intenções.',         3, 5, 30, ARRAY['journaling','reflexao'],    true),
  ('relacionamentos', 'Ligação ou encontro de qualidade',        'Ligue ou encontre alguém importante para você.',         3, 1, 40, ARRAY['relacionamento','conexao'], true);
