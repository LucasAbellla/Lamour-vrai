export function setupAuthUI({ auth, onAuthenticated }) {
  const gate = document.querySelector("#access-gate");
  const panels = {
    signin: document.querySelector("#signin-panel"),
    "mfa-enroll": document.querySelector("#mfa-enroll-panel"),
    "mfa-challenge": document.querySelector("#mfa-challenge-panel"),
    setup: document.querySelector("#setup-panel"),
    unlock: document.querySelector("#unlock-panel")
  };
  const setupForm = document.querySelector("#setup-form");
  const unlockForm = document.querySelector("#unlock-form");
  const setupError = document.querySelector("#setup-error");
  const unlockError = document.querySelector("#unlock-error");

  function setMode(mode) {
    Object.entries(panels).forEach(([name, panel]) => { panel.hidden = name !== mode; });
    gate.dataset.mode = mode;
    const focusTarget = panels[mode]?.querySelector("input:not([type='hidden'])");
    setTimeout(() => focusTarget?.focus(), 120);
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

  async function openVaultGate() {
    setMode(await auth.hasAccount() ? "unlock" : "setup");
  }

  async function advanceSecureAccess(initialState) {
    const state = initialState || await auth.securityState();
    if (state.stage === "signin") return setMode("signin");
    if (state.stage === "mfa-enroll") {
      const enrollment = await auth.startEnrollment();
      document.querySelector("#mfa-qr").src = enrollment.qrCode;
      document.querySelector("#mfa-secret").textContent = enrollment.secret;
      return setMode("mfa-enroll");
    }
    if (state.stage === "mfa-challenge") return setMode("mfa-challenge");
    return openVaultGate();
  }

  function setupSecureFlow() {
    setupForm.elements.passphrase.minLength = 14;
    document.querySelector("#setup-description").textContent = "A pessoa responsável prepara o cofre uma única vez. Todo o conteúdo será cifrado antes de sair deste aparelho.";
    document.querySelector("#setup-note").innerHTML = "<span>◇</span> A frase do cofre precisa ter 14 caracteres ou mais e deve ser compartilhada pessoalmente. Ela não pode ser recuperada pelo servidor.";
    document.querySelector("#unlock-description").textContent = "Digite a frase compartilhada por vocês. Ela nunca é enviada ao servidor e será esquecida ao bloquear o espaço.";

    const signinForm = document.querySelector("#signin-form");
    signinForm.addEventListener("submit", async event => {
      event.preventDefault();
      const error = document.querySelector("#signin-error");
      const success = document.querySelector("#signin-success");
      const submit = signinForm.querySelector('[type="submit"]');
      error.textContent = "";
      success.textContent = "";
      submit.disabled = true;
      submit.textContent = "Enviando…";
      try {
        await auth.requestAccessLink(signinForm.elements.email.value);
        success.textContent = "Se este for um dos dois e-mails autorizados, o link chegou. Abra-o neste mesmo aparelho.";
      } catch (issue) {
        error.textContent = issue.message;
      } finally {
        submit.disabled = false;
        submit.textContent = "Enviar link seguro";
      }
    });

    ["mfa-enroll", "mfa-challenge"].forEach(mode => {
      const form = document.querySelector(`#${mode}-form`);
      const error = document.querySelector(`#${mode}-error`);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        error.textContent = "";
        submit.disabled = true;
        try {
          await auth.verifyFactor(form.elements.code.value);
          form.reset();
          await openVaultGate();
        } catch (issue) {
          error.textContent = issue.message;
        } finally {
          submit.disabled = false;
        }
      });
    });

    void auth.initialize()
      .then(advanceSecureAccess)
      .catch(error => {
        setMode("signin");
        document.querySelector("#signin-error").textContent = error.message;
      });
  }

  document.body.classList.add("access-locked");
  document.querySelector("#app-shell").setAttribute("aria-hidden", "true");

  if (auth.mode === "secure") {
    setupSecureFlow();
    return;
  }

  const resumed = auth.tryResume();
  if (resumed) {
    void complete(resumed);
    return;
  }
  setMode(auth.hasAccount() ? "unlock" : "setup");
}
