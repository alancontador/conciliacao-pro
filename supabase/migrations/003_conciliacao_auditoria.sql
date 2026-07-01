-- ============================================================
-- ConciliaçãoPRO — Auditoria de Conciliação Inteligente
-- Execute este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

create table if not exists public.conciliacoes_auditoria (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  empresa_id    uuid        not null references public.empresas(id) on delete cascade,
  conta_numero  text        not null,
  razao_indices jsonb       not null,
  score         integer     not null,
  criterios     jsonb       not null,
  usuario_id    uuid        references public.profiles(id) on delete set null,
  criado_em     timestamptz not null default now()
);

alter table public.conciliacoes_auditoria enable row level security;

create policy "conciliacoes_auditoria_all" on public.conciliacoes_auditoria
  for all using (tenant_id = my_tenant_id());
