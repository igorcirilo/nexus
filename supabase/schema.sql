ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS days integer[] DEFAULT '{}';
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS type text DEFAULT 'custom';
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Lembretes próprios" ON public.reminders
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO badges (key, name, description, icon, xp_reward) VALUES
  ('primeiro_checkin', 'Primeira Vez', 'Completaste o teu primeiro check-in', '🌅', 50),
  ('streak_7', 'Uma Semana', '7 dias consecutivos de check-in', '🔥', 100),
  ('streak_21', 'Três Semanas', '21 dias consecutivos', '⚡', 250),
  ('streak_100', 'Centenário', '100 dias consecutivos', '💎', 1000),
  ('xp_1000', 'Mil Pontos', 'Atingiste 1.000 XP', '⭐', 50),
  ('xp_5000', 'Veterano', 'Atingiste 5.000 XP', '🏆', 100),
  ('xp_10000', 'Elite', 'Atingiste 10.000 XP', '👑', 200)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
