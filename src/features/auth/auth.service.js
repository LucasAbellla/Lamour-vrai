import { normalizeProfile } from "../../data/defaults.js";

const encoder = new TextEncoder();

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function deriveKey(passphrase, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations: 120000
  }, material, 256);
  return toBase64(new Uint8Array(bits));
}

export function createAuthService(namespace) {
  const accountKey = `${namespace}-local-account-v1`;
  const sessionKey = `${namespace}-session-v1`;
  let unlockedProfile = null;

  function readAccount() {
    try {
      return JSON.parse(localStorage.getItem(accountKey));
    } catch (_) {
      return null;
    }
  }

  return {
    hasAccount: () => Boolean(readAccount()?.credential?.hash),
    isUnlocked: () => Boolean(unlockedProfile),
    getProfile: () => unlockedProfile ? structuredClone(unlockedProfile) : null,
    async setup(profileInput, passphrase) {
      if (String(passphrase).length < 4) throw new Error("A frase de acesso precisa ter pelo menos 4 caracteres.");
      const profile = normalizeProfile(profileInput);
      if (!profile.partnerOne || !profile.partnerTwo) throw new Error("Informe os dois nomes para criar o espaço.");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await deriveKey(passphrase, salt);
      localStorage.setItem(accountKey, JSON.stringify({
        version: 1,
        profile,
        credential: { salt: toBase64(salt), hash }
      }));
      sessionStorage.setItem(sessionKey, "unlocked");
      unlockedProfile = profile;
      return structuredClone(profile);
    },
    async unlock(passphrase) {
      const account = readAccount();
      if (!account?.credential) throw new Error("Este espaço ainda não foi configurado.");
      const hash = await deriveKey(passphrase, fromBase64(account.credential.salt));
      if (hash !== account.credential.hash) throw new Error("A frase de acesso não confere.");
      sessionStorage.setItem(sessionKey, "unlocked");
      unlockedProfile = normalizeProfile(account.profile);
      return structuredClone(unlockedProfile);
    },
    tryResume() {
      const account = readAccount();
      if (sessionStorage.getItem(sessionKey) !== "unlocked" || !account?.profile) return null;
      unlockedProfile = normalizeProfile(account.profile);
      return structuredClone(unlockedProfile);
    },
    updateProfile(profileInput) {
      const account = readAccount();
      if (!account?.credential || !unlockedProfile) throw new Error("Desbloqueie o espaço antes de editar o perfil.");
      unlockedProfile = normalizeProfile({ ...unlockedProfile, ...profileInput });
      localStorage.setItem(accountKey, JSON.stringify({ ...account, profile: unlockedProfile }));
      return structuredClone(unlockedProfile);
    },
    lock() {
      unlockedProfile = null;
      sessionStorage.removeItem(sessionKey);
    }
  };
}
