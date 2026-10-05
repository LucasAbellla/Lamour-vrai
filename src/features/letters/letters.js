export function createLettersFeature({ store, feedback, getProfile }) {
  function latestLetter() {
    return [...store.getState().letters].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  }

  function render() {
    const profile = getProfile();
    const letter = latestLetter();
    document.querySelector("#letter-recipient").textContent = `${profile.partnerTwo},`;
    document.querySelector("#letter-signature").textContent = profile.partnerOne;
    document.querySelector("#letter-body").textContent = letter?.body || "Este espaço está esperando pelas palavras que só poderiam ter sido escritas por vocês.";
    document.querySelector("#letter-date").textContent = letter?.updatedAt
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(letter.updatedAt))
      : "Uma carta ainda por escrever";
  }

  function initialize() {
    const dialog = document.querySelector("#letter-dialog");
    const editor = document.querySelector("#letter-editor-dialog");
    const form = document.querySelector("#letter-form");
    document.querySelector("[data-open-letter]").addEventListener("click", () => {
      render();
      feedback.openDialog(dialog);
    });
    document.querySelector("[data-close-letter]").addEventListener("click", () => feedback.closeDialog(dialog));
    document.querySelector("[data-edit-letter]").addEventListener("click", () => {
      feedback.closeDialog(dialog);
      form.elements.body.value = latestLetter()?.body || "";
      feedback.openDialog(editor);
    });
    document.querySelectorAll("[data-close-letter-editor]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(editor)));
    form.addEventListener("submit", event => {
      event.preventDefault();
      const body = form.elements.body.value.trim();
      if (!body) return;
      const now = new Date().toISOString();
      store.update(state => {
        const letter = latestLetter();
        if (letter) Object.assign(letter, { body: body.slice(0, 4000), updatedAt: now });
        else state.letters.push({ id: `letter-${Date.now()}`, body: body.slice(0, 4000), createdAt: now, updatedAt: now });
      }, { feature: "letters" });
      feedback.toast("Carta guardada no cofre");
      render();
      feedback.closeDialog(editor);
      feedback.openDialog(dialog);
    });
    render();
  }

  return { initialize, render };
}
