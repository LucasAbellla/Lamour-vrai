import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

// Roda as migrações num Postgres em memória (PGlite) com o mínimo do Supabase simulado.
const repo = fileURLToPath(new URL("..", import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });

// Simulação mínima do que o Supabase oferece: papéis, auth, storage e a publicação do tempo real.
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema storage; create schema extensions;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid references auth.users(id), owner_id text);
  alter table storage.objects enable row level security;
  grant usage on schema auth, storage to authenticated;
  grant select on storage.objects to authenticated;
  create publication supabase_realtime;
`);
await db.exec(readFileSync(`${repo}/supabase/migrations/20261005190000_secure_couple_vault.sql`, "utf8"));
await db.exec(readFileSync(`${repo}/supabase/migrations/20261028120000_replace_partner_email.sql`, "utf8"));

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const asUser = id => db.exec(`select set_config('test.uid', '${id || ""}', false)`);
const userId = async email => (await one("select id from auth.users where email = $1", [email]))?.id;
const rejects = async (sql, pattern, message) => {
  await db.exec("savepoint t");
  try {
    await db.exec(sql);
    assert.fail(message);
  } catch (error) {
    if (error.code === "ERR_ASSERTION") throw error;
    assert.match(error.message, pattern, message);
  } finally {
    await db.exec("rollback to savepoint t");
  }
};

await db.exec("begin");
await db.query("select private.bootstrap_couple('dono@teste.dev', 'provisorio@teste.dev')");
await db.exec("insert into auth.users (email) values ('dono@teste.dev'), ('provisorio@teste.dev')");
const owner = await userId("dono@teste.dev");
const temporary = await userId("provisorio@teste.dev");
const couple = (await one("select couple_id from public.couple_members limit 1")).couple_id;
assert.equal((await one("select role from public.couple_members where user_id = $1", [temporary])).role, "partner");

// O dono e a conta provisória guardam coisas; a provisória também envia uma foto.
await asUser(owner);
await db.query("insert into public.vault_items (couple_id, kind, client_id, ciphertext, iv) values ($1, 'profile', 'couple-profile', 'abc', 'iv')", [couple]);
await asUser(temporary);
await db.query("insert into public.vault_items (couple_id, kind, client_id, ciphertext, iv) values ($1, 'memory', 'm1', 'def', 'iv'), ($1, 'letter', 'l1', 'ghi', 'iv')", [couple]);
await db.query("update public.vault_items set ciphertext = 'abc2' where client_id = 'couple-profile'");
await db.query("insert into storage.objects (bucket_id, name, owner, owner_id) values ('memory-media', $1, $2, $3)", [`${couple}/m1.bin`, temporary, temporary]);
await asUser(null);

await rejects("delete from auth.users where email = 'provisorio@teste.dev'", /foreign key/, "Sem a troca, a conta provisória não pode ser apagada (o problema que a função resolve).");
await rejects("select private.replace_partner_email('DONO@teste.dev ')", /different from the owner/, "O e-mail do dono não pode virar o da pessoa amada.");

const before = await one("select count(*)::int as n, string_agg(ciphertext, ',' order by client_id) as content from public.vault_items");
const message = (await one("select private.replace_partner_email('pessoa.real@teste.dev') as m")).m;
assert.match(message, /Apague a conta antiga/);

const after = await one("select count(*)::int as n, string_agg(ciphertext, ',' order by client_id) as content from public.vault_items");
assert.deepEqual(after, before, "Nenhum registro do cofre pode mudar ou sumir.");
assert.equal((await one("select count(*)::int as n from public.vault_items where updated_by = $1", [temporary])).n, 0);
assert.equal((await one("select owner from storage.objects")).owner, owner, "A foto passa para o dono.");
assert.equal((await one("select count(*)::int as n from public.couple_members")).n, 1, "Só o dono continua como membro.");
const invitation = await one("select email_hash = private.email_hash('pessoa.real@teste.dev') as ok, activated_user_id from private.allowed_users where role = 'partner'");
assert.equal(invitation.ok, true);
assert.equal(invitation.activated_user_id, null);
const triggers = await db.query("select tgname, tgenabled from pg_trigger where tgrelid = 'public.vault_items'::regclass and not tgisinternal");
assert.ok(triggers.rows.length === 2 && triggers.rows.every(row => row.tgenabled === "O"), "Os gatilhos voltam a ficar ligados.");
assert.equal((await one("select count(*)::int as n from private.audit_log where action = 'REPLACE_PARTNER'")).n, 1);

// Agora a conta provisória pode ser apagada e a pessoa real entra como partner.
await db.exec("delete from auth.users where email = 'provisorio@teste.dev'");
await db.exec("insert into auth.users (email) values ('pessoa.real@teste.dev')");
const real = await userId("pessoa.real@teste.dev");
assert.equal((await one("select role from public.couple_members where user_id = $1", [real])).role, "partner");
await rejects("insert into auth.users (email) values ('provisorio@teste.dev')", /not authorized/, "O e-mail provisório perde a autorização.");
await rejects("insert into auth.users (email) values ('estranho@teste.dev')", /not authorized/, "Terceiros continuam barrados.");

// O gatilho de toque continua funcionando depois da troca.
await asUser(real);
await db.query("update public.vault_items set ciphertext = 'jkl' where client_id = 'l1'");
assert.equal((await one("select updated_by from public.vault_items where client_id = 'l1'")).updated_by, real);
await asUser(null);

// Trocar de novo antes de a pessoa entrar (convite ainda não usado) também funciona.
await db.exec("delete from public.couple_members where user_id = '" + real + "'");
await db.exec("update private.allowed_users set activated_user_id = null where role = 'partner'");
await asUser(owner);
await db.exec("update public.vault_items set ciphertext = ciphertext where updated_by = '" + real + "'");
await asUser(null);
await db.exec("delete from auth.users where id = '" + real + "'");
const unused = (await one("select private.replace_partner_email('outra@teste.dev') as m")).m;
assert.match(unused, /Crie a conta do novo e-mail/);
await db.exec("rollback");

// ---------- Acesso sem o autenticador ----------
await db.exec("begin");
await db.query("select private.bootstrap_couple('dono@teste.dev', 'pessoa@teste.dev')");
await db.exec("insert into auth.users (email) values ('dono@teste.dev'), ('pessoa@teste.dev')");
const dono = await userId("dono@teste.dev");
const pessoa = await userId("pessoa@teste.dev");
const casal = (await one("select couple_id from public.couple_members limit 1")).couple_id;
await db.query("insert into public.vault_config (couple_id, kdf_salt, kdf_iterations, wrapped_key, wrapped_key_iv) values ($1, 'sal', 600000, 'chave', 'iv')", [casal]);
await asUser(dono);
await db.query("insert into public.vault_items (couple_id, kind, client_id, ciphertext, iv) values ($1, 'memory', 'm1', 'abc', 'iv')", [casal]);
await db.query("insert into storage.objects (bucket_id, name, owner, owner_id) values ('memory-media', $1, $2, $3)", [`${casal}/m1.bin`, dono, dono]);
await asUser(null);

// Uma sessão comum: e-mail confirmado (aal1), sem segundo fator.
const stranger = crypto.randomUUID();
const tables = ["public.couples", "public.couple_members", "public.vault_config", "public.vault_items", "storage.objects"];
const visibleTo = async id => {
  await db.exec(`select set_config('test.uid', '${id}', true), set_config('test.jwt', '{"aal":"aal1"}', true); set local role authenticated`);
  const seen = [];
  for (const table of tables) seen.push((await one(`select count(*)::int as n from ${table}`)).n);
  await db.exec("reset role");
  await asUser(null);
  return seen;
};

assert.deepEqual(await visibleTo(pessoa), [0, 0, 0, 0, 0], "Antes da migração, o banco ainda pede o segundo fator.");

await db.exec(readFileSync(`${repo}/supabase/migrations/20261030120000_remove_totp_requirement.sql`, "utf8"));
assert.equal((await one("select count(*)::int as n from pg_policies where qual like '%aal2%' or with_check like '%aal2%'")).n, 0, "Nenhuma regra pode continuar pedindo o segundo fator.");
assert.equal((await one("select to_regprocedure('private.current_aal2()') as fn")).fn, null);

assert.deepEqual(await visibleTo(pessoa), [1, 2, 1, 1, 1], "As duas contas do casal abrem o cofre só com a sessão do e-mail.");
assert.deepEqual(await visibleTo(dono), [1, 2, 1, 1, 1]);
assert.deepEqual(await visibleTo(stranger), [0, 0, 0, 0, 0], "Uma sessão de fora do casal continua sem ver nada.");

await asUser(stranger);
await rejects(`set local role authenticated; insert into public.vault_items (couple_id, kind, client_id, ciphertext, iv) values ('${casal}', 'memory', 'm2', 'x', 'iv')`, /row-level security/, "Quem é de fora não grava no cofre.");
await asUser(null);
await rejects("set local role anon; select * from public.vault_items", /permission denied/, "Sem sessão, o cofre nem responde.");
await db.exec("rollback");

console.log("Banco validado: troca de e-mail com cofre intacto, foto e autoria passam ao dono, conta provisória apagável, nova pessoa entra como partner e gatilhos religados; sem o autenticador, as duas contas abrem o cofre e terceiros continuam barrados.");
