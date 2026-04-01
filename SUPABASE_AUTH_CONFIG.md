# Configurar Supabase para Email + Password

## Passo 1 — Activar Email Provider

1. Vai a **Supabase Dashboard → Authentication → Providers**
2. Clica em **Email**
3. Garante:
   - ✅ "Enable Email provider" = ON
   - ✅ "Confirm email" = OFF (para login imediato sem confirmar email)
     OU ON se quiseres confirmação por email

## Passo 2 — Configurar URL de redirect

1. Vai a **Authentication → URL Configuration**
2. Em **Site URL**:
   ```
   https://nexus-lcd.vercel.app
   ```
3. Em **Redirect URLs** adiciona:
   ```
   https://nexus-lcd.vercel.app/**
   http://localhost:3000/**
   ```

## Passo 3 — Desactivar magic link (opcional)

O código já não usa magic link. Se quiseres desactivar completamente:
1. **Authentication → Settings**
2. "Allow passwordless sign-in via email" → OFF

## Passo 4 — Permitir novos registos

1. **Authentication → Settings**
2. "Enable signups" → ON (aberto) ou OFF (só convites)

## Para convidar utilizadores manualmente

1. **Authentication → Users → Invite user**
2. Introduz o email → o utilizador recebe email para criar password

## Política de passwords

Por defeito o Supabase exige mínimo 6 caracteres.
Para alterar: **Authentication → Settings → Password minimum length**
