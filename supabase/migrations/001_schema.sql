-- ============================================================
-- ConciliaçãoPRO — Schema Multi-Tenant
-- Execute este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- 1. TENANTS — escritórios de contabilidade (cada cliente que compra o sistema)
create table if not exists public.tenants (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null,
  cnpj        text,
  email       text,
  plano       text        not null default 'basico',
  ativo       boolean     not null default true,
  criado_em   timestamptz not null default now()
);

-- 2. PROFILES — dados extras de cada usuário (complementa auth.users do Supabase)
create table if not exists public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  nome          text        not null,
  role          text        not null default 'analista',
  status        text        not null default 'ativo',
  permissoes    jsonb       not null default '{}',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3. CONVITES — convites para novos usuários de um escritório
create table if not exists public.convites (
  id          uuid        primary key default gen_random_uuid(),
  token       uuid        unique not null default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  email       text        not null,
  nome        text        not null,
  role        text        not null default 'analista',
  permissoes  jsonb       not null default '{}',
  expires_at  timestamptz not null default now() + interval '7 days',
  aceito      boolean     not null default false,
  criado_em   timestamptz not null default now()
);

-- 4. EMPRESAS — clientes contábeis de cada escritório
create table if not exists public.empresas (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  razao_social  text        not null,
  nome_fantasia text,
  cnpj          text,
  periodo       text,
  responsavel   text,
  email         text,
  telefone      text,
  ativa         boolean     not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 5. CONTAS — status de conciliação por empresa
create table if not exists public.contas (
  id                   uuid        primary key default gen_random_uuid(),
  empresa_id           uuid        not null references public.empresas(id) on delete cascade,
  tenant_id            uuid        not null references public.tenants(id) on delete cascade,
  numero               text        not null,
  descricao            text,
  natureza             text,
  status               text        not null default 'NAO_CONCILIADO',
  documentos           jsonb       not null default '[]',
  prazo_regularizacao  timestamptz,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  unique (empresa_id, numero)
);

-- 6. DADOS_EMPRESA — balancete, razão e histórico de importação (JSONB por empresa)
create table if not exists public.dados_empresa (
  id                   uuid        primary key default gen_random_uuid(),
  empresa_id           uuid        not null unique references public.empresas(id) on delete cascade,
  tenant_id            uuid        not null references public.tenants(id) on delete cascade,
  balancete_data       jsonb       not null default '[]',
  razao_data           jsonb       not null default '[]',
  reconciled_indices   jsonb       not null default '[]',
  import_history       jsonb       not null default '[]',
  atualizado_em        timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (isolamento de dados por tenant)
-- ============================================================

alter table public.tenants        enable row level security;
alter table public.profiles       enable row level security;
alter table public.convites       enable row level security;
alter table public.empresas       enable row level security;
alter table public.contas         enable row level security;
alter table public.dados_empresa  enable row level security;

-- Função helper: retorna o tenant_id do usuário autenticado
create or replace function public.my_tenant_id()
returns uuid
language sql stable security definer
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- Função helper: verifica se o usuário é admin
create or replace function public.is_admin_or_gerente()
returns boolean
language sql stable security definer
as $$
  select role in ('admin', 'gerente') from public.profiles where id = auth.uid();
$$;

-- TENANTS
create policy "tenant_select"  on public.tenants for select using (id = my_tenant_id());
create policy "tenant_update"  on public.tenants for update using (id = my_tenant_id() and is_admin_or_gerente());

-- PROFILES
create policy "profile_select_own_tenant" on public.profiles
  for select using (tenant_id = my_tenant_id());

create policy "profile_self_select" on public.profiles
  for select using (id = auth.uid());

create policy "profile_insert" on public.profiles
  for insert with check (tenant_id = my_tenant_id() and is_admin_or_gerente());

create policy "profile_update" on public.profiles
  for update using (tenant_id = my_tenant_id() and is_admin_or_gerente());

create policy "profile_delete" on public.profiles
  for delete using (tenant_id = my_tenant_id() and is_admin_or_gerente());

-- CONVITES
create policy "convites_all" on public.convites
  for all using (tenant_id = my_tenant_id());

-- EMPRESAS
create policy "empresas_all" on public.empresas
  for all using (tenant_id = my_tenant_id());

-- CONTAS
create policy "contas_all" on public.contas
  for all using (tenant_id = my_tenant_id());

-- DADOS_EMPRESA
create policy "dados_all" on public.dados_empresa
  for all using (tenant_id = my_tenant_id());

-- ============================================================
-- TRIGGERS — atualiza atualizado_em automaticamente
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();

create trigger trg_empresas_updated_at
  before update on public.empresas
  for each row execute function set_updated_at();

create trigger trg_contas_updated_at
  before update on public.contas
  for each row execute function set_updated_at();

create trigger trg_dados_updated_at
  before update on public.dados_empresa
  for each row execute function set_updated_at();

-- ============================================================
-- POLÍTICA ESPECIAL: permite criar tenant + profile no signup
-- (necessário porque o usuário ainda não tem perfil ao se registrar)
-- ============================================================

-- Qualquer usuário autenticado pode inserir UM tenant (o seu próprio no signup)
create policy "tenant_insert_on_signup" on public.tenants
  for insert with check (true);

-- Permite criar o próprio profile no momento do registro
create policy "profile_insert_on_signup" on public.profiles
  for insert with check (id = auth.uid());

-- Permite aceitar convite (criar profile via token)
create policy "profile_insert_via_convite" on public.profiles
  for insert with check (
    exists (
      select 1 from public.convites
      where convites.email = (select email from auth.users where id = auth.uid())
        and convites.aceito = false
        and convites.expires_at > now()
    )
  );

-- Convites: qualquer pessoa pode ler o seu convite pelo token (para aceitar)
create policy "convites_read_by_token" on public.convites
  for select using (true);

create policy "convites_update_accept" on public.convites
  for update using (true);
