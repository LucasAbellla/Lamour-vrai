const rawEnvironment = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || "development";

export const environment = Object.freeze({
  name: rawEnvironment,
  isProduction: rawEnvironment === "production",
  authMode: import.meta.env.VITE_AUTH_MODE || "local",
  dataMode: import.meta.env.VITE_DATA_MODE || "local",
  storageNamespace: import.meta.env.VITE_STORAGE_NAMESPACE || "lamour-vrai",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
});

export function assertEnvironment() {
  if (environment.isProduction && environment.authMode !== "supabase") {
    throw new Error("A versão publicada não permite o modo local.");
  }
  if ((environment.authMode === "supabase" || environment.dataMode === "supabase") && (!environment.supabaseUrl || !environment.supabaseAnonKey)) {
    throw new Error("A autenticação online precisa das variáveis do Supabase.");
  }
  if ((environment.authMode === "supabase") !== (environment.dataMode === "supabase")) {
    throw new Error("Autenticação e dados seguros precisam ser ativados juntos.");
  }
  if (environment.isProduction && !environment.supabaseUrl.startsWith("https://")) {
    throw new Error("A versão publicada exige uma conexão HTTPS com o cofre.");
  }
  if (environment.supabaseAnonKey.startsWith("sb_secret_")) {
    throw new Error("Uma chave administrativa nunca pode ser usada no aplicativo.");
  }
  try {
    const encoded = (environment.supabaseAnonKey.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    if (payload.role === "service_role") throw new Error("Uma chave administrativa nunca pode ser usada no aplicativo.");
  } catch (error) {
    if (error.message.includes("administrativa")) throw error;
  }
}
