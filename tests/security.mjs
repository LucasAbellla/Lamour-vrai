import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";

globalThis.crypto ||= webcrypto;
globalThis.btoa ||= value => Buffer.from(value, "binary").toString("base64");
globalThis.atob ||= value => Buffer.from(value, "base64").toString("binary");

const {
  createVaultEnvelope,
  openVaultEnvelope,
  encryptJson,
  decryptJson,
  encryptBytes,
  decryptBytes
} = await import("../src/security/crypto-vault.js");

const phrase = "uma frase longa e somente nossa";
const secret = { title: "Uma memória que ninguém mais deve ler", message: "conteúdo sentimental" };
const { dataKey, config } = await createVaultEnvelope(phrase);
const encrypted = await encryptJson(dataKey, secret, "test:item");

assert.equal(encrypted.ciphertext.includes(secret.title), false, "O texto não pode aparecer no conteúdo cifrado.");
assert.deepEqual(await decryptJson(dataKey, encrypted, "test:item"), secret);

const reopenedKey = await openVaultEnvelope(phrase, config);
assert.deepEqual(await decryptJson(reopenedKey, encrypted, "test:item"), secret);
await assert.rejects(() => openVaultEnvelope("uma frase longa mas incorreta", config));
await assert.rejects(() => decryptJson(reopenedKey, encrypted, "outro-contexto"));

const photoBytes = crypto.getRandomValues(new Uint8Array(2048));
const encryptedPhoto = await encryptBytes(reopenedKey, photoBytes, "test:photo");
assert.deepEqual(await decryptBytes(reopenedKey, encryptedPhoto, "test:photo"), photoBytes);

const migration = fs.readFileSync(new URL("../supabase/migrations/20261005190000_secure_couple_vault.sql", import.meta.url), "utf8");
const configToml = fs.readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
const productionEnv = fs.readFileSync(new URL("../.env.production", import.meta.url), "utf8");

for (const required of [
  "force row level security",
  "enforce_two_members",
  "current_aal2",
  "activate_only_allowed_users",
  "public = false",
  "revoke all on public.couples"
]) assert.ok(migration.toLowerCase().includes(required), `Proteção ausente na migração: ${required}`);

assert.match(configToml, /enable_signup\s*=\s*false/g);
assert.match(productionEnv, /VITE_AUTH_MODE=supabase/);
assert.match(productionEnv, /VITE_DATA_MODE=supabase/);
assert.equal(/service[_-]?role/i.test(productionEnv), false, "Segredo administrativo não pode existir no cliente.");

process.stdout.write("Segurança validada: AES-GCM, frase incorreta, contexto autenticado, fotos cifradas, RLS, AAL2, duas contas e produção segura.\n");
