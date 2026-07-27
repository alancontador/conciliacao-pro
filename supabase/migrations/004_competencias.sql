-- ============================================================
-- ConciliaçãoPRO — Conciliação por Competência (MM/AAAA)
-- Execute este SQL no SQL Editor do seu projeto Supabase.
--
-- Estratégia (decidida com o usuário):
--   • A competência (formato 'AAAA-MM') passa a ser a dimensão de tempo.
--   • Toda conciliação fica vinculada a (empresa_id, competencia).
--   • "Começar do zero": os dados atuais de contas/balancete/razão/auditoria
--     são limpos para que a nova chave composta seja aplicada sem ambiguidade.
--   • O campo livre `periodo` da empresa é removido (substituído pela competência).
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOVA TABELA: competencias
--    Uma linha por (empresa, competência). Guarda status e o histórico.
-- ------------------------------------------------------------
create table if not exists public.competencias (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null references public.tenants(id)  on delete cascade,
  empresa_id     uuid        not null references public.empresas(id) on delete cascade,
  competencia    text        not null,                         -- 'AAAA-MM'
  status         text        not null default 'EM_ANDAMENTO',  -- EM_ANDAMENTO | CONCLUIDA
  concluida_em   timestamptz,
  concluida_por  uuid        references public.profiles(id) on delete set null,
  kpis_snapshot  jsonb,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (empresa_id, competencia)
);

alter table public.competencias enable row level security;

create policy "competencias_all" on public.competencias
  for all using (tenant_id = public.my_tenant_id());

create trigger trg_competencias_updated_at
  before update on public.competencias
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. LIMPEZA (começar do zero) — remove os dados atuais que serão
--    re-importados já vinculados a uma competência.
-- ------------------------------------------------------------
truncate table public.conciliacoes_auditoria;
truncate table public.contas;
truncate table public.dados_empresa;

-- ------------------------------------------------------------
-- 3. COLUNA competencia nas tabelas de dados + novas constraints
-- ------------------------------------------------------------

-- CONTAS: chave passa de (empresa_id, numero) para (empresa_id, competencia, numero)
alter table public.contas drop constraint if exists contas_empresa_id_numero_key;
alter table public.contas add column if not exists competencia text not null;
alter table public.contas
  add constraint contas_empresa_competencia_numero_key
  unique (empresa_id, competencia, numero);

-- DADOS_EMPRESA: chave passa de (empresa_id) para (empresa_id, competencia)
alter table public.dados_empresa drop constraint if exists dados_empresa_empresa_id_key;
alter table public.dados_empresa add column if not exists competencia text not null;
alter table public.dados_empresa
  add constraint dados_empresa_empresa_competencia_key
  unique (empresa_id, competencia);

-- AUDITORIA: passa a registrar a competência do lançamento conciliado
alter table public.conciliacoes_auditoria add column if not exists competencia text;

-- ------------------------------------------------------------
-- 4. Remove o campo livre `periodo` da empresa (substituído pela competência)
-- ------------------------------------------------------------
alter table public.empresas drop column if exists periodo;
