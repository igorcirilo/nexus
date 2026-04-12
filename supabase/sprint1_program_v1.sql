-- Sprint 1: Assessment, Score e Programa de 60 dias
-- Aplicar via Supabase Dashboard > SQL Editor na Task 13

-- ── task_templates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area               text NOT NULL,
  title              text NOT NULL,
  description        text,
  difficulty         int DEFAULT 1,
  frequency_per_week int DEFAULT 7,
  xp_reward          int DEFAULT 20,
  tags               text[],
  active             bool DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

-- ── user_assessments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_assessments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  version      int DEFAULT 2,
  responses    jsonb NOT NULL,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE user_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assessments" ON user_assessments
  FOR ALL USING (auth.uid() = user_id);

-- ── life_area_scores ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS life_area_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  assessment_id uuid REFERENCES user_assessments(id) ON DELETE CASCADE,
  area          text NOT NULL,
  score         int NOT NULL,
  snapshot_at   timestamptz DEFAULT now()
);

ALTER TABLE life_area_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scores" ON life_area_scores
  FOR ALL USING (auth.uid() = user_id);

-- ── programs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  assessment_id uuid REFERENCES user_assessments(id),
  status        text DEFAULT 'active',
  started_at    date NOT NULL,
  ends_at       date NOT NULL,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own programs" ON programs
  FOR ALL USING (auth.uid() = user_id);

-- ── program_weeks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_weeks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid REFERENCES programs(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  theme       text,
  starts_on   date NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weeks" ON program_weeks
  FOR ALL USING (
    program_id IN (SELECT id FROM programs WHERE user_id = auth.uid())
  );

-- ── program_days ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid REFERENCES programs(id) ON DELETE CASCADE,
  week_id     uuid REFERENCES program_weeks(id) ON DELETE CASCADE,
  day_number  int NOT NULL,
  date        date NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own days" ON program_days
  FOR ALL USING (
    program_id IN (SELECT id FROM programs WHERE user_id = auth.uid())
  );

-- ── program_tasks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   uuid REFERENCES programs(id) ON DELETE CASCADE,
  day_id       uuid REFERENCES program_days(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users NOT NULL,
  template_id  uuid REFERENCES task_templates(id),
  title        text NOT NULL,
  description  text,
  area         text NOT NULL,
  difficulty   int DEFAULT 1,
  xp_reward    int DEFAULT 20,
  status       text DEFAULT 'pending',
  source       text DEFAULT 'generated',
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE program_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks" ON program_tasks
  FOR ALL USING (auth.uid() = user_id);

-- ── Extensão de profiles ───────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS program_id         uuid REFERENCES programs(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS initial_score      int;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_score      int;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_version int DEFAULT 1;

-- ── Seeds: task_templates (difficulty = 1) ─────────────────
INSERT INTO task_templates (area, title, description, difficulty, frequency_per_week, xp_reward, tags) VALUES
  ('corpo',           'Beber 2L de água',        'Hidrate-se ao longo do dia. Beba um copo a cada 2 horas.',                             1, 7, 15, ARRAY['hidratacao','saude']),
  ('corpo',           '20min de movimento',       'Caminhada, alongamento, yoga ou qualquer exercício de 20 minutos.',                   1, 5, 25, ARRAY['exercicio','saude']),
  ('produtividade',   'Planejar o dia (5min)',     'Escreva suas 3 prioridades do dia antes de começar.',                                1, 7, 15, ARRAY['planejamento','foco']),
  ('produtividade',   'Bloco de foco de 25min',   'Trabalhe sem interrupções por 25 minutos em uma única tarefa.',                      1, 5, 25, ARRAY['foco','pomodoro']),
  ('emocoes',         'Escrever 1 gratidão',      'Anote uma coisa pela qual você é grato hoje.',                                       1, 7, 15, ARRAY['gratidao','bemEstar']),
  ('emocoes',         '5min de respiração',       'Respire fundo: 4s inspirar, 4s segurar, 4s expirar. Repita por 5 minutos.',          1, 3, 15, ARRAY['respiracao','ansiedade']),
  ('idiomas',         'Estudar 10min',            'Pratique vocabulário, gramática ou conversação por 10 minutos.',                     1, 5, 20, ARRAY['idiomas','aprendizagem']),
  ('carreira',        'Ler 10 páginas',           'Leia 10 páginas de um livro da sua área ou de desenvolvimento pessoal.',             1, 5, 20, ARRAY['leitura','crescimento']),
  ('financas',        'Registrar 1 gasto',        'Anote no seu app ou caderno qualquer gasto que fizer hoje.',                         1, 7, 15, ARRAY['financas','controle']),
  ('relacionamentos', 'Mensagem para alguém',     'Envie uma mensagem genuína para um amigo, familiar ou colega.',                      1, 3, 20, ARRAY['conexao','social']);
