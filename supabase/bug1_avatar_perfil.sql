-- Bug 1 · Perfil unificado: foto de perfil
-- Adiciona a coluna avatar_url ao perfil e cria o bucket público "avatars"
-- com políticas de acesso (cada utilizador escreve apenas na sua pasta).

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars públicos para leitura" on storage.objects;
create policy "Avatars públicos para leitura"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Upload de avatar próprio" on storage.objects;
create policy "Upload de avatar próprio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Atualizar avatar próprio" on storage.objects;
create policy "Atualizar avatar próprio"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Apagar avatar próprio" on storage.objects;
create policy "Apagar avatar próprio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
