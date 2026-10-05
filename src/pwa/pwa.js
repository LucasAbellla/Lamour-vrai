import { registerSW } from "virtual:pwa-register";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function setupPwa({ feedback }) {
  const installDialog = document.querySelector("#install-dialog");
  const updateBanner = document.querySelector("#update-banner");
  const connectionStatus = document.querySelector("#connection-status");
  const connectionDot = document.querySelector("#connection-dot");
  let deferredInstallPrompt = null;
  let updateServiceWorker = null;

  const updateConnectionStatus = () => {
    const online = navigator.onLine;
    connectionStatus.textContent = online ? (isStandalone() ? "App instalado" : "Conectado") : "Modo offline";
    connectionDot.classList.toggle("offline", !online);
    document.documentElement.classList.toggle("is-offline", !online);
  };

  const openInstallExperience = async () => {
    if (isStandalone()) {
      feedback.toast("L'amour vrai já está instalado neste aparelho");
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === "accepted") feedback.toast("Instalação iniciada");
      return;
    }
    feedback.openDialog(installDialog);
  };

  document.querySelectorAll("[data-install-app]").forEach(button => button.addEventListener("click", openInstallExperience));
  document.querySelectorAll("[data-close-install]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(installDialog)));

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.documentElement.classList.add("can-install");
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.documentElement.classList.add("is-installed");
    updateConnectionStatus();
    feedback.toast("L'amour vrai foi instalado neste aparelho");
  });
  window.addEventListener("online", () => {
    updateConnectionStatus();
    feedback.toast("Conexão restaurada");
  });
  window.addEventListener("offline", () => {
    updateConnectionStatus();
    feedback.toast("Sem internet — suas memórias locais continuam disponíveis");
  });

  document.querySelector("#pwa-update-now").addEventListener("click", () => {
    document.querySelector("#pwa-update-now").disabled = true;
    void updateServiceWorker?.(true);
  });
  document.querySelector("#pwa-update-later").addEventListener("click", () => { updateBanner.hidden = true; });

  updateConnectionStatus();
  if (!["http:", "https:"].includes(window.location.protocol)) {
    connectionStatus.textContent = "Aplicativo para computador";
    return;
  }

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateBanner.hidden = false;
    },
    onOfflineReady() {
      feedback.toast("Pronto para funcionar mesmo sem internet");
    },
    onRegisterError(error) {
      console.error("Não foi possível preparar o modo offline.", error);
    }
  });
}
