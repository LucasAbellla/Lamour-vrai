const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const VAULT_KDF_ITERATIONS = 600000;

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function deriveWrappingKey(passphrase, salt, iterations = VAULT_KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations
  }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptRaw(key, bytes, additionalData = "") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv,
    additionalData: encoder.encode(additionalData)
  }, key, bytes);
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv)
  };
}

async function decryptRaw(key, payload, additionalData = "") {
  try {
    const plaintext = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: base64ToBytes(payload.iv),
      additionalData: encoder.encode(additionalData)
    }, key, base64ToBytes(payload.ciphertext));
    return new Uint8Array(plaintext);
  } catch (_) {
    throw new Error("A frase do cofre não confere ou os dados foram alterados.");
  }
}

export async function createVaultEnvelope(passphrase) {
  if (String(passphrase).normalize("NFKC").length < 14) {
    throw new Error("Use uma frase do cofre com pelo menos 14 caracteres.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKey(passphrase, salt);
  const rawDataKey = crypto.getRandomValues(new Uint8Array(32));
  const dataKey = await crypto.subtle.importKey("raw", rawDataKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const wrapped = await encryptRaw(wrappingKey, rawDataKey, "lamour-vrai:v1:vault-key");
  rawDataKey.fill(0);
  return {
    dataKey,
    config: {
      kdfSalt: bytesToBase64(salt),
      kdfIterations: VAULT_KDF_ITERATIONS,
      wrappedKey: wrapped.ciphertext,
      wrappedKeyIv: wrapped.iv
    }
  };
}

export async function openVaultEnvelope(passphrase, config) {
  const wrappingKey = await deriveWrappingKey(
    passphrase,
    base64ToBytes(config.kdfSalt),
    config.kdfIterations
  );
  const rawDataKey = await decryptRaw(wrappingKey, {
    ciphertext: config.wrappedKey,
    iv: config.wrappedKeyIv
  }, "lamour-vrai:v1:vault-key");
  try {
    return await crypto.subtle.importKey("raw", rawDataKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } finally {
    rawDataKey.fill(0);
  }
}

export async function encryptJson(dataKey, value, context) {
  return encryptRaw(dataKey, encoder.encode(JSON.stringify(value)), `lamour-vrai:v1:${context}`);
}

export async function decryptJson(dataKey, payload, context) {
  const bytes = await decryptRaw(dataKey, payload, `lamour-vrai:v1:${context}`);
  return JSON.parse(decoder.decode(bytes));
}

export async function encryptBytes(dataKey, bytes, context) {
  return encryptRaw(dataKey, bytes, `lamour-vrai:v1:${context}`);
}

export async function decryptBytes(dataKey, payload, context) {
  return decryptRaw(dataKey, payload, `lamour-vrai:v1:${context}`);
}

export function decodeBase64(value) {
  return base64ToBytes(value);
}

export function encodeBase64(bytes) {
  return bytesToBase64(bytes);
}
