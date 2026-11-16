-- Osso a Osso: tabela de progresso + regras de segurança.
-- Cole tudo no Supabase em: SQL Editor > New query > Run.

create table if not exists public.progresso (
  user_id         uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  chave           text        not null,          -- módulo-nível-dificuldade, ex.: esqueleto-0-medio
  ppm             integer     not null default 0, -- palavras por minuto (melhor marca)
  acerto_primeira integer     not null default 0, -- % de peças acertadas de primeira (melhor marca)
  revisao_em      timestamptz,                    -- quando revisar de novo
  atualizado_em   timestamptz not null default now(),
  primary key (user_id, chave)
);

-- Cada pessoa só enxerga e altera o PRÓPRIO progresso.
alter table public.progresso enable row level security;

drop policy if exists "ver o próprio progresso"     on public.progresso;
drop policy if exists "criar o próprio progresso"   on public.progresso;
drop policy if exists "alterar o próprio progresso" on public.progresso;
drop policy if exists "apagar o próprio progresso"  on public.progresso;

create policy "ver o próprio progresso" on public.progresso
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar o próprio progresso" on public.progresso
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "alterar o próprio progresso" on public.progresso
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "apagar o próprio progresso" on public.progresso
  for delete to authenticated using ((select auth.uid()) = user_id);



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

-- Funil anônimo da degustação (o site só grava; a leitura é pelo painel)
create table if not exists public.eventos_funil (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  visita text not null check (char_length(visita) between 8 and 40),
  evento text not null check (evento in ('abriu','comecou','primeira_peca','rodada','viu_assinatura','clicou_assinar','clicou_conta_gratis','jogar_de_novo','ligou_3d')),
  detalhe text check (detalhe is null or char_length(detalhe) <= 60),
  origem text check (origem is null or char_length(origem) <= 60)
);
alter table public.eventos_funil enable row level security;
create policy "funil grava" on public.eventos_funil for insert to anon, authenticated with check (true);
revoke all on public.eventos_funil from anon, authenticated;
grant insert on public.eventos_funil to anon, authenticated;
