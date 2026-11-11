-- Osso a Osso: tabela de recompensas (XP, ofensiva e conquistas).
-- Se você JÁ rodou o supabase.sql antes, rode só este arquivo: SQL Editor > New query > Run.

create table if not exists public.recompensas (
  user_id         uuid        primary key default auth.uid() references auth.users(id) on delete cascade,
  xp              integer     not null default 0,
  ofensiva        integer     not null default 0,   -- dias seguidos estudando
  melhor_ofensiva integer     not null default 0,   -- recorde de dias seguidos
  ultimo_dia      date,                             -- último dia em que concluiu um nível
  conquistas      text[]      not null default '{}',
  atualizado_em   timestamptz not null default now()
);

alter table public.recompensas enable row level security;

drop policy if exists "ver as próprias recompensas"     on public.recompensas;
drop policy if exists "criar as próprias recompensas"   on public.recompensas;
drop policy if exists "alterar as próprias recompensas" on public.recompensas;

create policy "ver as próprias recompensas" on public.recompensas
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar as próprias recompensas" on public.recompensas
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "alterar as próprias recompensas" on public.recompensas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
