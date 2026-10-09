export function createExperience({ store, feedback, auth, getProfile, onProfileChanged, memories, capsules, dreams, letters }) {
  function setupStory() {
    const dialog = document.querySelector("#story-dialog");
    const content = document.querySelector("#story-content");
    let index = 0;
    const steps = () => {
      const profile = getProfile();
      const names = `${profile.partnerOne} ♥ ${profile.partnerTwo}`;
      return [
        ["Nossa história começou a guardar um novo tipo de memória.", "E cada uma delas ajuda a explicar quem somos juntos."],
        ["Entre dias enormes e detalhes quase invisíveis…", "O amor encontrou um jeito de transformar tudo em lembrança."],
        ["Fotografias, cartas, encontros e saudades agora têm um lugar.", "Um arquivo vivo, feito para continuar crescendo."],
        [`Feliz caminho, ${profile.nickname || "meu amor"}.`, `Eu escolheria tudo outra vez. ${names}`]
      ];
    };
    const draw = () => {
      const currentSteps = steps();
      document.querySelector("#story-text").textContent = currentSteps[index][0];
      document.querySelector("#story-subtext").textContent = currentSteps[index][1];
      document.querySelector("#story-counter").textContent = `${String(index + 1).padStart(2, "0")} / ${String(currentSteps.length).padStart(2, "0")}`;
      document.querySelector("#story-progress").style.width = `${((index + 1) / currentSteps.length) * 100}%`;
      document.querySelector("#story-next").textContent = index === currentSteps.length - 1 ? "Voltar ao nosso céu" : "Continuar →";
    };
    document.querySelectorAll("[data-open-story]").forEach(button => button.addEventListener("click", () => {
      index = 0;
      draw();
      feedback.openDialog(dialog);
    }));
    document.querySelector("#story-next").addEventListener("click", () => {
      if (index === steps().length - 1) return feedback.closeDialog(dialog);
      content.classList.add("changing");
      setTimeout(() => { index += 1; draw(); }, 260);
      setTimeout(() => content.classList.remove("changing"), 550);
    });
    document.querySelector("[data-close-story]").addEventListener("click", () => feedback.closeDialog(dialog));
  }

  function setupProfileEditor() {
    const dialog = document.querySelector("#profile-dialog");
    const form = document.querySelector("#profile-form");
    const open = () => {
      const profile = getProfile();
      form.elements.partnerOne.value = profile.partnerOne;
      form.elements.partnerTwo.value = profile.partnerTwo;
      form.elements.nickname.value = profile.nickname;
      form.elements.relationshipStart.value = profile.relationshipStart;
      form.elements.dedication.value = profile.dedication;
      document.querySelector("#profile-form-error").textContent = "";
      feedback.openDialog(dialog);
    };
    document.querySelectorAll("[data-open-profile]").forEach(button => button.addEventListener("click", open));
    document.querySelectorAll("[data-close-profile]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(dialog)));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const profile = await auth.updateProfile({
          partnerOne: form.elements.partnerOne.value,
          partnerTwo: form.elements.partnerTwo.value,
          nickname: form.elements.nickname.value,
          relationshipStart: form.elements.relationshipStart.value,
          dedication: form.elements.dedication.value
        });
        onProfileChanged(profile);
        feedback.toast("Dados do casal atualizados");
        feedback.closeDialog(dialog);
      } catch (error) {
        document.querySelector("#profile-form-error").textContent = error.message;
      }
    });
    return { open };
  }

  function setupBackup() {
    const exportButton = document.querySelector("#export-data");
    const importInput = document.querySelector("#import-data");
    const importLabel = document.querySelector('label[for="import-data"]');
    if (auth.mode === "secure") {
      exportButton.textContent = "Backup cifrado automático";
      importLabel.hidden = true;
      importInput.disabled = true;
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
    importInput.addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported.memories) || !Array.isArray(imported.dreams)) throw new Error();
        store.replace(imported, { feature: "backup" });
        if (imported.profile) onProfileChanged(auth.updateProfile(imported.profile));
        memories.render();
        capsules.render();
        dreams.render();
        letters.render();
        feedback.toast("Backup restaurado com sucesso");
      } catch (_) {
        feedback.toast("Esse arquivo não parece ser um backup válido");
      }
      event.target.value = "";
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
    setupStory();
    const profileEditor = setupProfileEditor();
    setupBackup();
    setupCommandPalette(profileEditor);
    setupSmallInteractions();
  }

  return { initialize };
}
