-- ============================================================
-- 005 — Correção do fluxo de convite (aceitar convite / criar conta)
--
-- PROBLEMAS CORRIGIDOS
--
-- 1) A policy "profile_insert_via_convite" consultava auth.users dentro do
--    WITH CHECK. Os roles `anon` e `authenticated` NÃO têm SELECT em
--    auth.users, então o insert do profile falhava com "permission denied for
--    table users". O usuário do Auth já havia sido criado no signUp, então a
--    2ª tentativa batia em "User already registered" — sem saída.
--
-- 2) Quando a confirmação de e-mail está ligada no projeto, o signUp devolve
--    user mas NÃO devolve sessão. O insert rodava como `anon` (auth.uid() é
--    null) e nenhuma policy passava.
--
-- 3) "convites_read_by_token ... using (true)" permitia que QUALQUER pessoa
--    (inclusive anônima) listasse todos os convites de todos os escritórios,
--    com e-mail e token — ou seja, entrar em qualquer tenant. O mesmo valia
--    para o update.
--
-- SOLUÇÃO: duas RPCs SECURITY DEFINER com escopo mínimo (só o convite do
-- token informado) e remoção das policies permissivas/quebradas.
-- ============================================================

-- ── 1. Leitura do convite pelo token ─────────────────────────────────────────
-- Expõe só os campos necessários à tela, e só do token informado.
create or replace function public.convite_por_token(p_token uuid)
returns table (
  email      text,
  nome       text,
  role       text,
  expires_at timestamptz,
  aceito     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.email, c.nome, c.role, c.expires_at, c.aceito
  from public.convites c
  where c.token = p_token
$$;

revoke all on function public.convite_por_token(uuid) from public;
grant execute on function public.convite_por_token(uuid) to anon, authenticated;

-- ── 2. Aceite do convite ─────────────────────────────────────────────────────
-- Cria (ou reaproveita) o profile do usuário autenticado a partir do convite.
-- Idempotente: se o profile já existir — caso típico de retry após falha —
-- atualiza em vez de estourar chave duplicada.
create or replace function public.aceitar_convite(p_token uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite public.convites%rowtype;
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    raise exception 'nao_autenticado';
  end if;

  select * into v_convite from public.convites where token = p_token;
  if not found then
    raise exception 'convite_invalido';
  end if;
  if v_convite.expires_at < now() then
    raise exception 'convite_expirado';
  end if;
  if lower(v_convite.email) <> v_email then
    raise exception 'email_divergente';
  end if;

  insert into public.profiles (id, tenant_id, nome, email, role, status, permissoes)
  values (
    v_uid,
    v_convite.tenant_id,
    coalesce(nullif(btrim(p_nome), ''), v_convite.nome),
    v_convite.email,
    v_convite.role,
    'ativo',
    v_convite.permissoes
  )
  on conflict (id) do update set
    tenant_id  = excluded.tenant_id,
    nome       = excluded.nome,
    email      = excluded.email,
    role       = excluded.role,
    status     = 'ativo',
    permissoes = excluded.permissoes;

  update public.convites set aceito = true where token = p_token;

  return v_convite.tenant_id;
end;
$$;

revoke all on function public.aceitar_convite(uuid, text) from public;
grant execute on function public.aceitar_convite(uuid, text) to authenticated;

-- ── 3. Remove as policies permissivas e a quebrada ───────────────────────────
-- O acesso ao convite passa a ser exclusivamente pelas RPCs acima.
drop policy if exists "convites_read_by_token"     on public.convites;
drop policy if exists "convites_update_accept"     on public.convites;
drop policy if exists "profile_insert_via_convite" on public.profiles;

-- Admin/gerente do escritório continuam enxergando e gerenciando seus convites
-- (a policy "convites_all" de 001 já cobre isso via my_tenant_id()).
