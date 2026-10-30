import { createClient } from "@supabase/supabase-js";
import { normalizeProfile } from "../../data/defaults.js";
import { createVaultEnvelope, openVaultEnvelope } from "../../security/crypto-vault.js";
import { createSecureVaultRepository, fetchVaultConfig, insertVaultConfig } from "../../security/secure-vault.repository.js";

function sessionStorageAdapter(namespace) {
  const prefix = `${namespace}-supabase-`;
  return {
    getItem(key) {
      return sessionStorage.getItem(`${prefix}${key}`);
    },
    setItem(key, value) {
      sessionStorage.setItem(`${prefix}${key}`, value);
    },
    removeItem(key) {
      sessionStorage.removeItem(`${prefix}${key}`);
    }
  };
}

function ensure(result, fallback) {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data;
}

export function createSecureAuthService(environment) {
  const supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: sessionStorageAdapter(environment.storageNamespace)
    }
  });
  let membership = null;
  let profile = null;
  let repository = null;
  let initialState = null;

  async function getSession() {
    return ensure(await supabase.auth.getSession(), "Não foi possível verificar a sessão.")?.session || null;
  }

  async function ensureMembership() {
    if (membership) return membership;
    const user = ensure(await supabase.auth.getUser(), "Não foi possível validar esta pessoa.")?.user;
    if (!user) throw new Error("A sessão terminou. Peça um novo link de acesso.");
    const result = await supabase
      .from("couple_members")
      .select("couple_id,role")
      .eq("user_id", user.id)
      .maybeSingle();
    const row = ensure(result, "Não foi possível confirmar o acesso ao espaço.");
    if (!row) throw new Error("Esta conta não faz parte deste espaço particular.");
    membership = { ...row, userId: user.id, email: user.email };
    return membership;
  }

  async function securityState() {
    const session = await getSession();
    if (!session) return { stage: "signin" };
    await ensureMembership();
    return { stage: "vault" };
  }

  async function buildRepository(dataKey) {
    const member = await ensureMembership();
    repository = createSecureVaultRepository({
      supabase,
      coupleId: member.couple_id,
      userId: member.userId,
      dataKey,
      onError(error) {
        window.dispatchEvent(new CustomEvent("lamour:vault-error", { detail: error }));
      }
    });
    initialState = await repository.loadState();
  }

  return {
    mode: "secure",
    isUnlocked: () => Boolean(profile && repository),
    getProfile: () => profile ? structuredClone(profile) : null,
    // A identidade vem do banco: owner = quem preparou o cofre, partner = a pessoa amada.
    canChooseRole: false,
    getRole: () => membership?.role || "owner",
    setRole() {},
    async initialize() {
      const state = await securityState();
      const url = new URL(window.location.href);
      const containsAuthResponse = url.searchParams.has("code") || url.searchParams.has("error") || /access_token|refresh_token/.test(url.hash);
      if (containsAuthResponse) {
        url.searchParams.delete("code");
        url.searchParams.delete("error");
        url.searchParams.delete("error_code");
        url.searchParams.delete("error_description");
        url.hash = "";
        history.replaceState({}, document.title, `${url.pathname}${url.search}`);
      }
      return state;
    },
    async requestAccessLink(email) {
      const normalizedEmail = String(email).trim().toLocaleLowerCase("pt-BR");
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("Informe um e-mail válido.");
      const redirectTo = new URL(import.meta.env.BASE_URL || "/", window.location.origin).href;
      ensure(await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo }
      }), "Não foi possível enviar o código de acesso.");
    },
    // O mesmo e-mail traz um código. No app instalado no iPhone o link abre no Safari, então o código é o caminho.
    async verifyEmailCode(email, code) {
      const normalizedEmail = String(email).trim().toLocaleLowerCase("pt-BR");
      const token = String(code).replace(/\s/g, "");
      if (!/^\d{6,10}$/.test(token)) throw new Error("Digite os números do código que chegou no e-mail.");
      ensure(await supabase.auth.verifyOtp({ email: normalizedEmail, token, type: "email" }), "O código não confere ou expirou. Peça um novo e-mail.");
    },
    securityState,
    async hasAccount() {
      const member = await ensureMembership();
      return Boolean(await fetchVaultConfig(supabase, member.couple_id));
    },
    async setup(profileInput, passphrase) {
      const member = await ensureMembership();
      if (member.role !== "owner") throw new Error("A pessoa responsável precisa preparar o cofre antes do segundo acesso.");
      const cleanProfile = normalizeProfile(profileInput);
      if (!cleanProfile.partnerOne || !cleanProfile.partnerTwo) throw new Error("Informe os dois nomes para criar o espaço.");
      const { dataKey, config } = await createVaultEnvelope(passphrase);
      await insertVaultConfig(supabase, member.couple_id, config);
      await buildRepository(dataKey);
      profile = await repository.saveProfile(cleanProfile);
      return structuredClone(profile);
    },
    async unlock(passphrase) {
      const member = await ensureMembership();
      const config = await fetchVaultConfig(supabase, member.couple_id);
      if (!config) throw new Error("O cofre ainda não foi preparado pela pessoa responsável.");
      const dataKey = await openVaultEnvelope(passphrase, config);
      await buildRepository(dataKey);
      profile = await repository.loadProfile();
      if (!profile) throw new Error("O perfil protegido ainda não foi criado.");
      return structuredClone(profile);
    },
    tryResume() {
      return null;
    },
    async updateProfile(profileInput) {
      if (!repository || !profile) throw new Error("Abra o cofre antes de editar o perfil.");
      // Parte da versão mais recente do cofre, para não desfazer o que a outra pessoa salvou nesse meio-tempo.
      const latest = await repository.loadProfile();
      profile = await repository.saveProfile({ ...(latest || profile), ...profileInput });
      return structuredClone(profile);
    },
    // Fotos das páginas e músicas da rádio, cifradas com a mesma chave do cofre.
    getMedia: () => repository?.media || null,
    getStoreOptions() {
      if (!repository || !initialState) throw new Error("O cofre precisa estar aberto.");
      return {
        initialState,
        localPersistence: false,
        persist: (state, meta) => repository.persist(state, meta),
        subscribeRemote: repository.subscribe,
        reloadRemote: repository.loadState
      };
    },
    async lock() {
      profile = null;
      repository = null;
      membership = null;
      initialState = null;
      await supabase.auth.signOut({ scope: "local" });
    }
  };
}
