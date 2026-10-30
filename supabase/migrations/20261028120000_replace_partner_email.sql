-- Troca o e-mail autorizado da pessoa amada (papel "partner") sem apagar nada do cofre.
-- Serve para usar um e-mail provisório enquanto o projeto ainda está sendo ajustado e,
-- antes da entrega, colocar o e-mail real. Execute no SQL Editor:
--   select private.replace_partner_email('EMAIL_REAL');
-- Depois apague a conta antiga em Authentication → Users e crie a nova com Auto Confirm.

create or replace function private.replace_partner_email(new_partner_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_couple uuid;
  owner_user uuid;
  old_partner uuid;
begin
  if (select count(*) from private.allowed_users where role = 'partner') <> 1 then
    raise exception 'Expected exactly one partner invitation';
  end if;
  select couple_id into target_couple from private.allowed_users where role = 'partner';

  if exists (
    select 1 from private.allowed_users
    where couple_id = target_couple and role = 'owner' and email_hash = private.email_hash(new_partner_email)
  ) then
    raise exception 'The partner email must be different from the owner email';
  end if;

  select user_id into owner_user from public.couple_members where couple_id = target_couple and role = 'owner';
  select user_id into old_partner from public.couple_members where couple_id = target_couple and role = 'partner';

  if old_partner is not null then
    if owner_user is null then
      raise exception 'The owner must sign in before an active partner can be replaced';
    end if;

    -- O que a conta provisória salvou passa a constar como salvo pelo dono, para a conta poder ser apagada.
    -- Os gatilhos são desligados só durante esta transação: o de toque trocaria o autor por um usuário vazio.
    alter table public.vault_items disable trigger touch_vault_item_before_write;
    alter table public.vault_items disable trigger audit_vault_change_after_write;
    update public.vault_items set updated_by = owner_user where updated_by = old_partner;
    alter table public.vault_items enable trigger touch_vault_item_before_write;
    alter table public.vault_items enable trigger audit_vault_change_after_write;

    -- O Supabase recusa apagar uma conta que ainda é dona de arquivos.
    update storage.objects
    set owner = owner_user, owner_id = owner_user::text
    where bucket_id = 'memory-media' and (owner = old_partner or owner_id = old_partner::text);

    delete from public.couple_members where couple_id = target_couple and role = 'partner';
  end if;

  update private.allowed_users
  set email_hash = private.email_hash(new_partner_email), activated_user_id = null, activated_at = null
  where couple_id = target_couple and role = 'partner';

  insert into private.audit_log (couple_id, action) values (target_couple, 'REPLACE_PARTNER');

  if old_partner is null then
    return 'Convite trocado. Crie a conta do novo e-mail em Authentication > Users, com Auto Confirm.';
  end if;
  return 'Convite trocado. Apague a conta antiga (id ' || old_partner || ') em Authentication > Users e crie a do novo e-mail, com Auto Confirm.';
end;
$$;

revoke all on function private.replace_partner_email(text) from public, anon, authenticated;
