-- Índices para o caminho de leitura mais quente da app.
--
-- CONTEXTO (incidente de 2026-08-26/27): o Disk IO da instância esgotou-se e o
-- Postgres ficou lento ao ponto de o GoTrue não conseguir validar sessões —
-- /auth/v1/token passou a devolver 504 e depois 502, e o login deixou de
-- funcionar. As sondas internas do Supabase (/rest-admin/v1/ready) chegaram a
-- responder 521.
--
-- PORQUÊ habit_logs: é a tabela mais lida do produto e não tinha índice útil
-- para o padrão real de consulta. Só existia
--   UNIQUE (user_id, habit_id, date)
-- onde `date` é a TERCEIRA coluna. Uma consulta do tipo
--   WHERE user_id = X AND completed AND date >= Y
-- só consegue usar o prefixo `user_id`: o Postgres lê TODAS as linhas desse
-- utilizador, de todo o histórico, e filtra o resto em memória. Como a tabela
-- cresce uma linha por hábito por dia, o custo sobe todos os dias.
--
-- E é lido muitas vezes: abrir /hoje faz duas varreduras (getRitmo, 14 dias, e
-- getHojeMetrics, 30 dias) e cada hábito marcado dispara outra (getRitmo).
--
-- O INCLUDE permite index-only scan: o Postgres responde sem tocar na tabela,
-- que é exactamente o IO que queremos deixar de gastar.
CREATE INDEX IF NOT EXISTS habit_logs_user_date_idx
  ON public.habit_logs (user_id, date)
  INCLUDE (completed, habit_id);

-- focus_sessions só tinha PRIMARY KEY (id). A app apaga e exporta por
-- user_id (ver TABLES em src/lib/account.ts), o que sem índice é varredura
-- sequencial da tabela inteira.
CREATE INDEX IF NOT EXISTS focus_sessions_user_date_idx
  ON public.focus_sessions (user_id, date DESC);

-- Estatísticas actualizadas para o planeador passar a escolher os índices novos.
ANALYZE public.habit_logs;
ANALYZE public.focus_sessions;
