-- Osso a Osso: assinatura Pro (Kiwify). Já aplicado no projeto osso-a-osso.
-- O webhook da Kiwify chama a função "kiwify-webhook" (Edge Function), que grava nestas tabelas.

create table if not exists public.assinaturas (
  email                  text primary key check (email = lower(email)),
  status                 text not null default 'ativa' check (status in ('ativa','cancelada','atrasada','reembolsada')),
  plano                  text,
  pro_ate                timestamptz,   -- o aluno é Pro enquanto esta data estiver no futuro
  kiwify_order_id        text,
  kiwify_subscription_id text,
  ultimo_evento          text,
  atualizado_em          timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
create policy "ver a própria assinatura" on public.assinaturas
  for select to authenticated using (email = lower((select auth.jwt()) ->> 'email'));

-- Registro dos avisos recebidos e chaves do servidor: sem acesso pelo site.
create table if not exists public.kiwify_eventos (
  id bigint generated always as identity primary key,
  recebido_em timestamptz not null default now(),
  tipo text, email text, aceito boolean not null default true, payload jsonb
);
alter table public.kiwify_eventos enable row level security;
create table if not exists public.segredos (nome text primary key, valor text not null);
alter table public.segredos enable row level security;

-- Para dar Pro manualmente a alguém (cortesia), rode trocando o e-mail e a data:
-- insert into public.assinaturas (email, status, plano, pro_ate)
-- values ('aluno@exemplo.com', 'ativa', 'Cortesia', now() + interval '1 year')
-- on conflict (email) do update set status='ativa', plano='Cortesia', pro_ate=excluded.pro_ate;
