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
  if (environment.authMode === "supabase" && (!environment.supabaseUrl || !environment.supabaseAnonKey)) {
    throw new Error("A autenticação online precisa das variáveis do Supabase.");
  }
}
