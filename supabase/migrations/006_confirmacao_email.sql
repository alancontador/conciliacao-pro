-- ============================================================
-- 006 — Suporte à confirmação de e-mail ATIVA
--
-- Com "Confirm email" ligado, o signUp NÃO devolve sessão: o usuário só
-- consegue se autenticar depois de clicar no link de confirmação. Como criar
-- o profile (convite) ou o tenant (novo escritório) exige sessão, os dois
-- fluxos morriam no meio — a conta nascia no Auth sem vínculo nenhum, e a
-- pessoa ficava presa.
--
-- SOLUÇÃO: o cadastro passa a ser concluído no PRIMEIRO LOGIN, já com sessão
-- válida. O que estava pendente fica registrado no banco:
--   • convite  -> tabela `convites` (já existia), achado pelo e-mail
--   • novo escritório -> nova tabela `signups_pendentes`
-- ============================================================

-- ── 1. Convite pendente do próprio usuário ───────────────────────────────────
-- Devolve o token do convite endereçado ao e-mail do usuário autenticado, para
-- que o app conclua o aceite sozinho no primeiro login. Nunca expõe convite
-- de terceiros: filtra pelo e-mail do próprio JWT.
create or replace function public.meu_convite_pendente()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.token
  from public.convites c
  where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and c.aceito = false
    and c.expires_at > now()
  order by c.criado_em desc
  limit 1
$$;

revoke all on function public.meu_convite_pendente() from public;
grant execute on function public.meu_convite_pendente() to authenticated;

-- ── 2. Cadastro de escritório aguardando confirmação de e-mail ───────────────
create table if not exists public.signups_pendentes (
  email        text primary key,
  tenant_nome  text not null,
  tenant_cnpj  text not null default '',
  admin_nome   text not null,
  criado_em    timestamptz not null default now()
);

alter table public.signups_pendentes enable row level security;

-- Qualquer visitante pode registrar a intenção de criar escritório (é o que
-- ele acabou de preencher no formulário). O registro é inerte: só vira tenant
-- de verdade quando a MESMA pessoa confirma o e-mail e faz login.
drop policy if exists "signup_pendente_insert" on public.signups_pendentes;
create policy "signup_pendente_insert" on public.signups_pendentes
  for insert to anon, authenticated with check (true);

-- Cada um só enxerga/remove o registro do próprio e-mail.
drop policy if exists "signup_pendente_select_own" on public.signups_pendentes;
create policy "signup_pendente_select_own" on public.signups_pendentes
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "signup_pendente_delete_own" on public.signups_pendentes;
create policy "signup_pendente_delete_own" on public.signups_pendentes
  for delete to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Limpeza: registros não concluídos em 7 dias não servem mais para nada.
delete from public.signups_pendentes where criado_em < now() - interval '7 days';

-- ── 3. Conclui o cadastro do escritório no primeiro login ────────────────────
-- Reaproveita a RPC de signup existente e consome o registro pendente.
create or replace function public.finalizar_signup_pendente()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_pend  public.signups_pendentes%rowtype;
  v_tenant_id uuid;
  v_permissoes jsonb := jsonb_build_object(
    'verDashboard', true, 'verStatus', true, 'editarStatus', true,
    'importar', true, 'exportar', true,
    'gerenciarUsuarios', true, 'gerenciarEmpresas', true
  );
begin
  if v_uid is null then
    raise exception 'nao_autenticado';
  end if;

  -- Já tem escritório: nada a fazer.
  if exists (select 1 from public.profiles where id = v_uid) then
    return null;
  end if;

  select * into v_pend from public.signups_pendentes where lower(email) = v_email;
  if not found then
    return null;
  end if;

  insert into public.tenants (nome, cnpj)
  values (v_pend.tenant_nome, v_pend.tenant_cnpj)
  returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, nome, email, role, status, permissoes)
  values (v_uid, v_tenant_id, v_pend.admin_nome, v_email, 'admin', 'ativo', v_permissoes);

  delete from public.signups_pendentes where lower(email) = v_email;

  return v_tenant_id;
end;
$$;

revoke all on function public.finalizar_signup_pendente() from public;
grant execute on function public.finalizar_signup_pendente() to authenticated;
