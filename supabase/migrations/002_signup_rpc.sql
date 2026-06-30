-- Função RPC para criar tenant + profile no signup
-- SECURITY DEFINER: executa com privilégios do owner, bypass RLS
create or replace function public.signup_create_tenant_and_profile(
  p_tenant_nome  text,
  p_tenant_cnpj  text,
  p_admin_nome   text,
  p_permissoes   jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_user_id   uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Verifica se já tem profile (evita duplicata)
  if exists (select 1 from public.profiles where id = v_user_id) then
    select tenant_id into v_tenant_id from public.profiles where id = v_user_id;
    return json_build_object('tenant_id', v_tenant_id);
  end if;

  -- Cria o tenant
  insert into public.tenants (nome, cnpj)
  values (p_tenant_nome, nullif(trim(p_tenant_cnpj), ''))
  returning id into v_tenant_id;

  -- Cria o profile do admin
  insert into public.profiles (id, tenant_id, nome, role, status, permissoes)
  values (v_user_id, v_tenant_id, p_admin_nome, 'admin', 'ativo', p_permissoes);

  return json_build_object('tenant_id', v_tenant_id);
end;
$$;

-- Garante que qualquer usuário autenticado pode chamar esta função
grant execute on function public.signup_create_tenant_and_profile to authenticated;
