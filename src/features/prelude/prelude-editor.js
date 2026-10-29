import { PRELUDE_MAX_LINES, PRELUDE_MAX_LINE_LENGTH } from "../../data/defaults.js";

function parseLines(value) {
  return value.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function validationError(lines) {
  if (lines.length > PRELUDE_MAX_LINES) return `Use no máximo ${PRELUDE_MAX_LINES} frases, uma por linha.`;
  if (lines.some(line => line.length > PRELUDE_MAX_LINE_LENGTH)) return `Cada frase pode ter até ${PRELUDE_MAX_LINE_LENGTH} caracteres.`;
  return "";
}

// Cada pessoa escreve o prelúdio que a outra vai ver ao abrir o app.
export function createPreludeEditor({ auth, feedback, getProfile, getViewer, prelude, onProfileChanged }) {
  const dialog = document.querySelector("#prelude-dialog");
  const form = document.querySelector("#prelude-form");
  const counter = document.querySelector("#prelude-counter");
  const error = document.querySelector("#prelude-form-error");

  function updateCounter() {
    const lines = parseLines(form.elements.lines.value);
    counter.textContent = `${lines.length} de ${PRELUDE_MAX_LINES} frases`;
    counter.classList.toggle("over", Boolean(validationError(lines)));
    error.textContent = "";
  }

  function open() {
    const viewer = getViewer();
    const own = getProfile().preludes?.[viewer.role] || { lines: [], signature: "" };
    form.elements.lines.value = own.lines.join("\n");
    form.elements.signature.value = own.signature || viewer.self;
    form.elements.signature.placeholder = viewer.self;
    document.querySelector("#prelude-intro").textContent = `Aparece para ${viewer.beloved} ao abrir o app, com a tela escura: "eu te amo" em dezenas de línguas se junta para formar o nome de ${viewer.beloved}, suas frases surgem palavra por palavra e a sua assinatura é escrita à mão. ${viewer.isPartner ? "Sem frases, o app abre direto." : `Sem frases, ${viewer.beloved} vê só o "eu te amo" formando o nome.`}`;
    document.querySelector("[data-preview-prelude]").textContent = `Ver como ${viewer.beloved} vai ver`;
    updateCounter();
    feedback.openDialog(dialog);
  }

  document.querySelectorAll("[data-open-prelude]").forEach(button => button.addEventListener("click", open));
  document.querySelectorAll("[data-close-prelude]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(dialog)));
  form.elements.lines.addEventListener("input", updateCounter);

  document.querySelector("[data-preview-prelude]").addEventListener("click", async () => {
    const lines = parseLines(form.elements.lines.value);
    const issue = lines.length ? validationError(lines) : "Escreva pelo menos uma frase para ver o prelúdio.";
    if (issue) {
      error.textContent = issue;
      return;
    }
    const viewer = getViewer();
    feedback.closeDialog(dialog);
    await prelude.play({ name: viewer.beloved, lines, signature: form.elements.signature.value.trim() || viewer.self }, { continueLabel: "Voltar ao editor" });
    feedback.openDialog(dialog);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const lines = parseLines(form.elements.lines.value);
    const issue = validationError(lines);
    if (issue) {
      error.textContent = issue;
      return;
    }
    const viewer = getViewer();
    const profile = getProfile();
    try {
      const updated = await auth.updateProfile({
        preludes: { ...profile.preludes, [viewer.role]: { lines, signature: form.elements.signature.value } }
      });
      onProfileChanged(updated);
      feedback.toast(lines.length ? "Prelúdio guardado no cofre" : viewer.isPartner ? "Prelúdio removido — o app abre direto" : "Frases removidas — fica só o \"eu te amo\" formando o nome");
      feedback.closeDialog(dialog);
    } catch (issueOnSave) {
      error.textContent = issueOnSave.message;
    }
  });

  return { open };
}
