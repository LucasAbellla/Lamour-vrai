import { countItems, describeCounts, importBackupIntoStore, parseBackup } from "../core/backup.js";
import { preparePhotoDataUrl } from "../core/photos.js";
import { formToProfile, profileToForm } from "../core/perspective.js";

export function createExperience({ store, feedback, auth, getProfile, getViewer, onProfileChanged, memories, capsules, dreams, letters }) {
  function setupProfileEditor() {
    const dialog = document.querySelector("#profile-dialog");
    const form = document.querySelector("#profile-form");
    const fields = ["selfName", "belovedName", "nickname", "relationshipStart", "dedication"];
    const open = () => {
      const values = profileToForm(getProfile(), getViewer());
      fields.forEach(field => { form.elements[field].value = values[field] || ""; });
      document.querySelector("#profile-form-error").textContent = "";
      feedback.openDialog(dialog);
    };
    document.querySelectorAll("[data-open-profile]").forEach(button => button.addEventListener("click", open));
    document.querySelectorAll("[data-close-profile]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(dialog)));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const values = Object.fromEntries(fields.map(field => [field, form.elements[field].value]));
        const profile = await auth.updateProfile(formToProfile(values, getViewer()));
        onProfileChanged(profile);
        feedback.toast("Dados do casal atualizados");
        feedback.closeDialog(dialog);
      } catch (error) {
        document.querySelector("#profile-form-error").textContent = error.message;
      }
    });
    return { open };
  }

  function renderAll() {
    memories.render();
    capsules.render();
    dreams.render();
    letters.render();
  }

  function setupBackup() {
    const exportButton = document.querySelector("#export-data");
    const importInput = document.querySelector("#import-data");
    const importLabel = document.querySelector('label[for="import-data"]');
    const secure = auth.mode === "secure";
    const dialog = document.querySelector("#import-dialog");
    const title = document.querySelector("#import-title");
    const summary = document.querySelector("#import-summary");
    const note = document.querySelector("#import-note");
    const error = document.querySelector("#import-error");
    const confirmButton = document.querySelector("[data-confirm-import]");
    const cancelButton = document.querySelector("[data-cancel-import]");
    let pending = null;
    let retryOnly = false;
    let working = false;

    const preventLeaving = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    const setWorking = (value, label = "") => {
      working = value;
      confirmButton.disabled = value;
      cancelButton.disabled = value;
      if (label) confirmButton.textContent = label;
      if (value) window.addEventListener("beforeunload", preventLeaving);
      else window.removeEventListener("beforeunload", preventLeaving);
    };
    dialog.addEventListener("cancel", event => { if (working) event.preventDefault(); });
    cancelButton.addEventListener("click", () => feedback.closeDialog(dialog));

    function presentBackup(backup) {
      const counts = countItems(backup.state);
      const photos = backup.state.memories.filter(memory => memory.photo).length;
      const pieces = [`Este arquivo tem ${describeCounts(counts)}`];
      if (photos) pieces.push(`${photos} ${photos === 1 ? "memória tem fotografia" : "memórias têm fotografia"}`);
      summary.textContent = `${pieces.join("; ")}.`;
      const discarded = backup.discarded ? ` ${backup.discarded} ${backup.discarded === 1 ? "registro incompleto foi ignorado" : "registros incompletos foram ignorados"}.` : "";
      if (secure) {
        title.textContent = "Levar para o cofre?";
        note.textContent = `Tudo será cifrado neste aparelho antes de sair, e as fotografias serão reduzidas. O que já está no cofre continua intacto; registros repetidos são ignorados. Mantenha o aplicativo aberto até a confirmação.${discarded}`;
        confirmButton.textContent = "Levar para o cofre";
      } else {
        title.textContent = "Restaurar este backup?";
        note.textContent = `O conteúdo atual deste dispositivo será substituído pelo conteúdo do arquivo.${discarded}`;
        confirmButton.textContent = "Restaurar backup";
      }
      error.textContent = "";
      retryOnly = false;
      pending = backup;
      feedback.openDialog(dialog);
    }

    async function importIntoVault() {
      setWorking(true, "Preparando…");
      error.textContent = "";
      try {
        const result = retryOnly
          ? (store.replace(store.getState(), { feature: "backup" }), await store.whenSaved(), { totalAdded: -1 })
          : await importBackupIntoStore({
            store,
            backup: pending,
            preparePhoto: preparePhotoDataUrl,
            onProgress({ stage, current, total }) {
              confirmButton.textContent = stage === "photos"
                ? `Preparando fotografias ${current}/${total}…`
                : "Cifrando e enviando…";
            }
          });
        renderAll();
        setWorking(false);
        feedback.closeDialog(dialog);
        if (result.totalAdded === 0) feedback.toast("Tudo deste backup já estava no cofre");
        else if (result.totalAdded > 0) feedback.toast(`${describeCounts(result.added)} ${result.totalAdded === 1 ? "chegou" : "chegaram"} ao cofre cifrado`);
        else feedback.toast("Envio concluído — tudo está no cofre");
        pending = null;
      } catch (issue) {
        renderAll();
        setWorking(false, "Tentar enviar de novo");
        retryOnly = true;
        error.textContent = `Parte do conteúdo ainda não chegou ao cofre (${issue.message}). Verifique a conexão e tente de novo — nada será duplicado.`;
      }
    }

    async function restoreLocally() {
      setWorking(true, "Preparando…");
      error.textContent = "";
      try {
        const withPhotos = pending.state.memories.filter(memory => memory.photo);
        for (const [index, memory] of withPhotos.entries()) {
          confirmButton.textContent = `Preparando fotografias ${index + 1}/${withPhotos.length}…`;
          memory.photo = await preparePhotoDataUrl(memory.photo).catch(() => memory.photo);
        }
        store.replace(pending.state, { feature: "backup" });
        if (pending.profile) onProfileChanged(auth.updateProfile(pending.profile));
        renderAll();
        setWorking(false);
        feedback.closeDialog(dialog);
        feedback.toast("Backup restaurado com sucesso");
        pending = null;
      } catch (issue) {
        setWorking(false, "Restaurar backup");
        error.textContent = issue.message;
      }
    }

    confirmButton.addEventListener("click", () => {
      if (!pending || working) return;
      void (secure ? importIntoVault() : restoreLocally());
    });

    importInput.addEventListener("change", async event => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;
      try {
        presentBackup(parseBackup(await file.text()));
      } catch (issue) {
        feedback.toast(issue.message);
      }
    });

    if (secure) {
      exportButton.textContent = "Backup cifrado automático";
      importLabel.textContent = "Trazer backup local";
      exportButton.addEventListener("click", () => feedback.toast("O cofre já mantém uma cópia cifrada sincronizada"));
      return;
    }
    exportButton.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        profile: getProfile(),
        ...store.snapshot()
      }, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `lamour-vrai-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      feedback.toast("Backup preparado com carinho");
    });
  }

  function setupCommandPalette(profileEditor) {
    const dialog = document.querySelector("#command-dialog");
    const input = document.querySelector("#command-search");
    const list = document.querySelector("#command-list");
    const empty = document.querySelector("#command-empty");
    const visibleButtons = () => [...list.querySelectorAll("button")].filter(button => !button.hidden);
    const open = () => {
      input.value = "";
      list.querySelectorAll("button").forEach(button => { button.hidden = false; });
      empty.hidden = true;
      feedback.openDialog(dialog);
      setTimeout(() => input.focus(), 80);
    };
    const close = () => feedback.closeDialog(dialog);
    const run = command => {
      close();
      if (command === "new-memory") document.querySelector("[data-open-memory]").click();
      if (command === "surprise") memories.openRandom();
      if (command === "capsule") document.querySelector("[data-open-capsule]").click();
      if (command === "dream") document.querySelector("[data-open-dream]").click();
      if (command === "constellation") document.querySelector("#constelacao").scrollIntoView({ behavior: "smooth" });
      if (command === "story") document.querySelector("[data-open-story]").click();
      if (command === "profile") profileEditor.open();
      if (command === "prelude") document.querySelector("[data-open-prelude]").click();
      if (command === "install") document.querySelector("#install-app-footer").click();
      if (command === "lock") {
        void Promise.resolve(auth.lock()).finally(() => window.location.reload());
      }
      if (command === "backup") document.querySelector("#export-data").click();
    };
    document.querySelectorAll("[data-open-command]").forEach(button => button.addEventListener("click", open));
    input.addEventListener("input", () => {
      const query = input.value.trim().toLocaleLowerCase("pt-BR");
      list.querySelectorAll("button").forEach(button => {
        button.hidden = Boolean(query && !button.textContent.toLocaleLowerCase("pt-BR").includes(query));
      });
      empty.hidden = visibleButtons().length > 0;
    });
    list.addEventListener("click", event => {
      const button = event.target.closest("[data-command]");
      if (button) run(button.dataset.command);
    });
    input.addEventListener("keydown", event => {
      const buttons = visibleButtons();
      if (event.key === "ArrowDown" && buttons[0]) {
        event.preventDefault();
        buttons[0].focus();
      }
      if (event.key === "Enter" && buttons[0]) {
        event.preventDefault();
        run(buttons[0].dataset.command);
      }
    });
    list.addEventListener("keydown", event => {
      const buttons = visibleButtons();
      const index = buttons.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        (buttons[index + 1] || buttons[0])?.focus();
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        (buttons[index - 1] || input)?.focus();
      }
      if (event.key === "Enter" && document.activeElement?.dataset.command) run(document.activeElement.dataset.command);
    });
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dialog.open ? close() : open();
      }
      if (event.key === "Escape" && dialog.open) close();
    });
  }

  function setupSmallInteractions() {
    document.querySelector("#infinity").addEventListener("click", () => document.querySelector(".infinity-section").classList.toggle("revealed"));
  }

  function initialize() {
    const profileEditor = setupProfileEditor();
    setupBackup();
    setupCommandPalette(profileEditor);
    setupSmallInteractions();
  }

  return { initialize };
}
