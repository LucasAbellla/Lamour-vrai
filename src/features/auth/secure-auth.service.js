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
  let pendingFactor = null;
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
    const assurance = ensure(
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      "Não foi possível verificar o segundo fator."
    );
    if (assurance.currentLevel === "aal2") {
      await ensureMembership();
      return { stage: "vault" };
    }
    const factors = ensure(await supabase.auth.mfa.listFactors(), "Não foi possível consultar o segundo fator.");
    const verified = factors.totp?.find(factor => factor.status === "verified");
    if (verified) {
      pendingFactor = { factorId: verified.id };
      return { stage: "mfa-challenge" };
    }
    return { stage: "mfa-enroll" };
  }

  async function startEnrollment() {
    if (pendingFactor?.qrCode) return pendingFactor;
    const enrollment = ensure(await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "L'amour vrai"
    }), "Não foi possível preparar o autenticador.");
    pendingFactor = {
      factorId: enrollment.id,
      qrCode: enrollment.totp.qr_code,
      secret: enrollment.totp.secret
    };
    return pendingFactor;
  }

  async function verifyFactor(code) {
    if (!pendingFactor?.factorId) throw new Error("Recomece a configuração do segundo fator.");
    ensure(await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactor.factorId,
      code: String(code).replace(/\s/g, "")
    }), "O código não confere.");
    pendingFactor = null;
    await ensureMembership();
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
      }), "Não foi possível enviar o link de acesso.");
    },
    securityState,
    startEnrollment,
    verifyFactor,
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
      profile = await repository.saveProfile({ ...profile, ...profileInput });
      return structuredClone(profile);
    },
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
