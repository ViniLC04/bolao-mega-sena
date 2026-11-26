-- =====================================================================================================
-- Cadastra o ADM (rode UMA vez, depois de criar o usuário em Authentication → Users).
--
-- ANTES: troque as DUAS ocorrências de  SEU_USUARIO  abaixo pelo usuário que você escolheu
--        (o e-mail interno é sempre  usuario@example.com ; ex.: vinicius@example.com).
-- Só pode existir um ADM (o banco recusa um segundo).
-- =====================================================================================================
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = 'SEU_USUARIO@example.com';
  if v_id is null then
    raise exception 'Usuário não encontrado em Authentication → Users. Confira o e-mail (usuario@example.com).';
  end if;
  insert into public.admins (user_id) values (v_id) on conflict do nothing;
end
$$;

-- Deve mostrar UMA linha, com o e-mail do ADM:
select u.email, a.criado_em
from public.admins a
join auth.users u on u.id = a.user_id;
