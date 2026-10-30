-- Tira a exigência do autenticador (TOTP). A entrada passa a ser o código do e-mail e a frase do cofre.
-- Só caem as regras do segundo fator: continua valendo que apenas as duas contas do casal acessam o cofre,
-- e o conteúdo continua cifrado com a frase.
-- Execute uma vez no SQL Editor ANTES de publicar o site sem o autenticador. O site antigo continua
-- funcionando depois disto; o site novo, sem isto, não encontra o cofre.

drop policy if exists couples_mfa_required on public.couples;
drop policy if exists members_mfa_required on public.couple_members;
drop policy if exists vault_config_mfa_required on public.vault_config;
drop policy if exists vault_items_mfa_required on public.vault_items;
drop policy if exists memory_media_mfa_required on storage.objects;

drop function if exists private.current_aal2();
