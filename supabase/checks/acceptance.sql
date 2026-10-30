-- Conferência de aceite do L'amour vrai. Somente leitura: cole no SQL Editor do Supabase e execute.
-- Cada linha mostra o item, o resultado encontrado e se está "ok". Nenhum e-mail ou conteúdo é exibido.

with checks as (
  select 1 as ordem, 'Exatamente dois convites (owner + partner)' as item,
         (select count(*)::text from private.allowed_users) as encontrado,
         (select count(*) = 2 and count(distinct role) = 2 from private.allowed_users) as ok
  union all
  select 2, 'Nenhuma conta além das duas',
         (select count(*)::text from auth.users),
         (select count(*) <= 2 from auth.users)
  union all
  select 3, 'Membros do casal (no máximo dois, papéis distintos)',
         (select coalesce(string_agg(role, ', ' order by role), 'nenhum') from public.couple_members),
         (select count(*) <= 2 and count(*) = count(distinct role) from public.couple_members)
  union all
  select 4, 'RLS ativa e forçada nas tabelas do cofre',
         (select string_agg(relname || '=' || relrowsecurity::text || '/' || relforcerowsecurity::text, ', ' order by relname)
            from pg_class where oid in ('public.couples'::regclass, 'public.couple_members'::regclass, 'public.vault_config'::regclass, 'public.vault_items'::regclass)),
         (select bool_and(relrowsecurity and relforcerowsecurity)
            from pg_class where oid in ('public.couples'::regclass, 'public.couple_members'::regclass, 'public.vault_config'::regclass, 'public.vault_items'::regclass))
  union all
  select 5, 'Só membros do casal passam, sem exigir autenticador',
         (select count(*) filter (where qual like '%is_member%')::text || ' de membro, ' || count(*) filter (where qual like '%current_aal2%')::text || ' de autenticador' from pg_policies),
         (select count(*) filter (where qual like '%is_member%') >= 5 and count(*) filter (where qual like '%current_aal2%') = 0 from pg_policies)
  union all
  select 6, 'Bucket de fotos é privado e só aceita arquivos cifrados',
         (select coalesce(public::text || ' / ' || array_to_string(allowed_mime_types, ','), 'ausente') from storage.buckets where id = 'memory-media'),
         (select coalesce(not public and allowed_mime_types = array['application/octet-stream'], false) from storage.buckets where id = 'memory-media')
  union all
  select 7, 'Fotos guardadas apenas como .bin',
         (select count(*)::text from storage.objects where bucket_id = 'memory-media' and name not like '%.bin'),
         (select count(*) = 0 from storage.objects where bucket_id = 'memory-media' and name not like '%.bin')
  union all
  select 8, 'Cofre preparado (chave embrulhada com PBKDF2 forte)',
         (select coalesce(max(kdf_iterations)::text, 'ainda não preparado') from public.vault_config),
         (select coalesce(bool_and(kdf_iterations >= 600000), false) from public.vault_config)
  union all
  select 9, 'Conteúdo do cofre ilegível (sem JSON aberto)',
         (select count(*)::text || ' registros' from public.vault_items),
         (select coalesce(bool_and(ciphertext !~ '[{}" ]' and ciphertext ~ '^[A-Za-z0-9+/=]+$'), true) from public.vault_items)
  union all
  select 10, 'Sincronização em tempo real ligada',
         (select count(*)::text from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'vault_items'),
         (select count(*) = 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'vault_items')
)
select ordem, item, encontrado, case when ok then 'ok' else 'ATENÇÃO' end as resultado
from checks
order by ordem;

-- Para o teste manual do item "palavras não aparecem no cofre", troque PALAVRA por um termo de uma memória real
-- e confirme que o resultado é 0:
-- select count(*) from public.vault_items where ciphertext ilike '%PALAVRA%';
