-- L'amour vrai — cofre privado para exatamente duas pessoas.
-- Execute em um projeto Supabase dedicado. Nenhum e-mail ou segredo é salvo neste arquivo.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'L''amour vrai' check (char_length(label) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  created_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id),
  unique (couple_id, role)
);

create table private.allowed_users (
  couple_id uuid not null references public.couples(id) on delete cascade,
  email_hash text not null unique check (char_length(email_hash) = 64),
  role text not null check (role in ('owner', 'partner')),
  activated_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  primary key (couple_id, email_hash),
  unique (couple_id, role)
);

create table public.vault_config (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  kdf_salt text not null,
  kdf_iterations integer not null check (kdf_iterations >= 300000),
  wrapped_key text not null,
  wrapped_key_iv text not null,
  created_at timestamptz not null default now()
);

create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('profile', 'memory', 'dream', 'capsule', 'letter')),
  client_id text not null check (char_length(client_id) between 1 and 160),
  ciphertext text not null,
  iv text not null,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, kind, client_id)
);

create table private.audit_log (
  id bigint generated always as identity primary key,
  couple_id uuid,
  actor_id uuid,
  action text not null,
  item_kind text,
  client_id text,
  occurred_at timestamptz not null default now()
);

create or replace function private.email_hash(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select encode(extensions.digest(lower(trim(value)), 'sha256'), 'hex');
$$;

create or replace function private.current_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

create or replace function private.is_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_owner(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function private.storage_couple_id(object_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

grant execute on function private.current_aal2() to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;
grant execute on function private.storage_couple_id(text) to authenticated;

create or replace function private.enforce_two_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'This private space already has its two members';
  end if;
  return new;
end;
$$;

create trigger enforce_two_members_before_insert
before insert on public.couple_members
for each row execute function private.enforce_two_members();

create or replace function private.activate_allowed_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed private.allowed_users%rowtype;
begin
  select * into allowed
  from private.allowed_users
  where email_hash = private.email_hash(new.email)
    and (activated_user_id is null or activated_user_id = new.id)
  for update;

  if allowed.couple_id is null then
    raise exception 'This email is not authorized for L''amour vrai';
  end if;

  update private.allowed_users
  set activated_user_id = new.id, activated_at = now()
  where couple_id = allowed.couple_id and email_hash = allowed.email_hash;

  insert into public.couple_members (couple_id, user_id, role)
  values (allowed.couple_id, new.id, allowed.role)
  on conflict (couple_id, user_id) do nothing;

  return new;
end;
$$;

create trigger activate_only_allowed_users
after insert or update of email on auth.users
for each row execute function private.activate_allowed_user();

create or replace function private.touch_vault_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

create trigger touch_vault_item_before_write
before insert or update on public.vault_items
for each row execute function private.touch_vault_item();

create or replace function private.audit_vault_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_log (couple_id, actor_id, action, item_kind, client_id)
  values (
    coalesce(new.couple_id, old.couple_id),
    (select auth.uid()),
    tg_op,
    coalesce(new.kind, old.kind),
    coalesce(new.client_id, old.client_id)
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_vault_change_after_write
after insert or update or delete on public.vault_items
for each row execute function private.audit_vault_change();

alter table public.couples enable row level security;
alter table public.couples force row level security;
alter table public.couple_members enable row level security;
alter table public.couple_members force row level security;
alter table public.vault_config enable row level security;
alter table public.vault_config force row level security;
alter table public.vault_items enable row level security;
alter table public.vault_items force row level security;

create policy couples_member_read on public.couples
for select to authenticated
using (private.is_member(id));
create policy couples_mfa_required on public.couples as restrictive
for select to authenticated
using (private.current_aal2());

create policy members_same_couple_read on public.couple_members
for select to authenticated
using (private.is_member(couple_id));
create policy members_mfa_required on public.couple_members as restrictive
for select to authenticated
using (private.current_aal2());

create policy vault_config_member_read on public.vault_config
for select to authenticated
using (private.is_member(couple_id));
create policy vault_config_owner_create on public.vault_config
for insert to authenticated
with check (private.is_owner(couple_id));
create policy vault_config_mfa_required on public.vault_config as restrictive
for all to authenticated
using (private.current_aal2())
with check (private.current_aal2());

create policy vault_items_member_access on public.vault_items
for all to authenticated
using (private.is_member(couple_id))
with check (private.is_member(couple_id) and updated_by = (select auth.uid()));
create policy vault_items_mfa_required on public.vault_items as restrictive
for all to authenticated
using (private.current_aal2())
with check (private.current_aal2());

revoke all on public.couples, public.couple_members, public.vault_config, public.vault_items from anon;
grant select on public.couples, public.couple_members to authenticated;
grant select, insert on public.vault_config to authenticated;
grant select, insert, update, delete on public.vault_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-media', 'memory-media', false, 20971520, array['application/octet-stream'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy memory_media_member_read on storage.objects
for select to authenticated
using (
  bucket_id = 'memory-media'
  and private.is_member(private.storage_couple_id(name))
);
create policy memory_media_member_create on storage.objects
for insert to authenticated
with check (
  bucket_id = 'memory-media'
  and private.is_member(private.storage_couple_id(name))
);
create policy memory_media_member_update on storage.objects
for update to authenticated
using (
  bucket_id = 'memory-media'
  and private.is_member(private.storage_couple_id(name))
)
with check (
  bucket_id = 'memory-media'
  and private.is_member(private.storage_couple_id(name))
);
create policy memory_media_member_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'memory-media'
  and private.is_member(private.storage_couple_id(name))
);
create policy memory_media_mfa_required on storage.objects as restrictive
for all to authenticated
using (bucket_id <> 'memory-media' or private.current_aal2())
with check (bucket_id <> 'memory-media' or private.current_aal2());

do $$
begin
  alter publication supabase_realtime add table public.vault_items;
exception when duplicate_object then
  null;
end $$;

create or replace function private.bootstrap_couple(owner_email text, partner_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_couple_id uuid;
begin
  if lower(trim(owner_email)) = lower(trim(partner_email)) then
    raise exception 'Use two different email addresses';
  end if;

  insert into public.couples default values returning id into new_couple_id;
  insert into private.allowed_users (couple_id, email_hash, role)
  values
    (new_couple_id, private.email_hash(owner_email), 'owner'),
    (new_couple_id, private.email_hash(partner_email), 'partner');
  return new_couple_id;
end;
$$;

revoke all on function private.bootstrap_couple(text, text) from public, anon, authenticated;
revoke all on function private.email_hash(text) from public, anon, authenticated;
revoke all on function private.activate_allowed_user() from public, anon, authenticated;
revoke all on function private.enforce_two_members() from public, anon, authenticated;
revoke all on function private.touch_vault_item() from public, anon, authenticated;
revoke all on function private.audit_vault_change() from public, anon, authenticated;
