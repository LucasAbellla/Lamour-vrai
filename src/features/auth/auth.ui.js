export function setupAuthUI({ auth, onAuthenticated }) {
  const gate = document.querySelector("#access-gate");
  const setupPanel = document.querySelector("#setup-panel");
  const unlockPanel = document.querySelector("#unlock-panel");
  const setupForm = document.querySelector("#setup-form");
  const unlockForm = document.querySelector("#unlock-form");
  const setupError = document.querySelector("#setup-error");
  const unlockError = document.querySelector("#unlock-error");

  function setMode(mode) {
    const isSetup = mode === "setup";
    setupPanel.hidden = !isSetup;
    unlockPanel.hidden = isSetup;
    gate.dataset.mode = mode;
    setTimeout(() => (isSetup ? setupForm.elements.partnerOne : unlockForm.elements.passphrase).focus(), 120);
  }

  async function complete(profile) {
    await onAuthenticated(profile);
    gate.classList.add("leaving");
    document.body.classList.remove("access-locked");
    document.querySelector("#app-shell").removeAttribute("aria-hidden");
    setTimeout(() => { gate.hidden = true; }, 600);
  }

  setupForm.addEventListener("submit", async event => {
    event.preventDefault();
    setupError.textContent = "";
    const submit = setupForm.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Preparando nosso espaço…";
    try {
      const profile = await auth.setup({
        partnerOne: setupForm.elements.partnerOne.value,
        partnerTwo: setupForm.elements.partnerTwo.value,
        nickname: setupForm.elements.nickname.value,
        relationshipStart: setupForm.elements.relationshipStart.value,
        dedication: setupForm.elements.dedication.value,
        anniversaryNumber: 1
      }, setupForm.elements.passphrase.value);
      await complete(profile);
    } catch (error) {
      setupError.textContent = error.message;
    } finally {
      submit.disabled = false;
      submit.textContent = "Criar nosso espaço";
    }
  });

  unlockForm.addEventListener("submit", async event => {
    event.preventDefault();
    unlockError.textContent = "";
    const submit = unlockForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await complete(await auth.unlock(unlockForm.elements.passphrase.value));
      unlockForm.reset();
    } catch (error) {
      unlockError.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  const resumed = auth.tryResume();
  if (resumed) {
    void complete(resumed);
    return;
  }
  document.body.classList.add("access-locked");
  document.querySelector("#app-shell").setAttribute("aria-hidden", "true");
  setMode(auth.hasAccount() ? "unlock" : "setup");
}
