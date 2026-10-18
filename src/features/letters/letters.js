import { escapeHTML } from "../../core/formatters.js";

// Cada pessoa tem a sua carta. Cartas antigas, sem autoria, foram escritas por quem preparou o espaço.
function authorOf(letter) {
  return letter.author === "partner" ? "partner" : "owner";
}

function initial(name) {
  return (name || "").trim().charAt(0).toLocaleUpperCase("pt-BR") || "◇";
}

export function createLettersFeature({ store, feedback, getProfile, getViewer }) {
  let view = "mine";

  function letterBy(role) {
    return store.getState().letters
      .filter(letter => authorOf(letter) === role)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  }

  function renderSection() {
    const viewer = getViewer();
    const received = letterBy(viewer.belovedRole);
    const mine = letterBy(viewer.role);
    const beloved = viewer.beloved || "quem você ama";
    document.querySelector("#letter-eyebrow").textContent = received
      ? `UMA CARTA DE ${beloved.toLocaleUpperCase("pt-BR")}`
      : `UMA CARTA PARA ${beloved.toLocaleUpperCase("pt-BR")}`;
    document.querySelector("#letter-heading").innerHTML = received
      ? `${escapeHTML(beloved)} deixou palavras guardadas <em>para você.</em>`
      : "Tem uma coisa que eu ainda prefiro te dizer <em>como uma carta.</em>";
    document.querySelector("#letter-intro").textContent = received
      ? "Uma carta só sua, pronta para ser aberta quantas vezes você quiser."
      : mine
        ? `A sua carta já está guardada no cofre, esperando por ${beloved}.`
        : `Escreva sem pressa. A carta fica guardada aqui, pronta para ser aberta quando ${beloved} quiser.`;
    const from = received ? viewer.beloved : viewer.self;
    const to = received ? viewer.self : viewer.beloved;
    document.querySelector("#letter-initials").textContent = `${initial(from)} · ${initial(to)}`;
  }

  function renderDialog() {
    const viewer = getViewer();
    const received = letterBy(viewer.belovedRole);
    if (view === "received" && !received) view = "mine";
    const showingReceived = view === "received";
    const letter = showingReceived ? received : letterBy(viewer.role);
    document.querySelector("#letter-recipient").textContent = `${showingReceived ? viewer.self : viewer.beloved},`;
    document.querySelector("#letter-signature").textContent = showingReceived ? viewer.beloved : viewer.self;
    document.querySelector("#letter-body").textContent = letter?.body || "Este espaço está esperando pelas palavras que só poderiam ter sido escritas por você.";
    document.querySelector("#letter-date").textContent = letter?.updatedAt
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(letter.updatedAt))
      : "Uma carta ainda por escrever";
    document.querySelector("[data-edit-letter]").hidden = showingReceived;
    const switcher = document.querySelector("[data-switch-letter]");
    switcher.hidden = !received;
    switcher.textContent = showingReceived
      ? `Escrever ou reler a minha carta para ${viewer.beloved}`
      : `Ler a carta de ${viewer.beloved}`;
  }

  function render() {
    renderSection();
    renderDialog();
  }

  function open(preferred) {
    const viewer = getViewer();
    view = preferred || (letterBy(viewer.belovedRole) ? "received" : "mine");
    renderDialog();
    feedback.openDialog(document.querySelector("#letter-dialog"));
  }

  function initialize() {
    const dialog = document.querySelector("#letter-dialog");
    const editor = document.querySelector("#letter-editor-dialog");
    const form = document.querySelector("#letter-form");
    document.querySelector("[data-open-letter]").addEventListener("click", () => open());
    document.querySelector("[data-close-letter]").addEventListener("click", () => feedback.closeDialog(dialog));
    document.querySelector("[data-switch-letter]").addEventListener("click", () => {
      view = view === "received" ? "mine" : "received";
      renderDialog();
    });
    document.querySelector("[data-edit-letter]").addEventListener("click", () => {
      feedback.closeDialog(dialog);
      form.elements.body.value = letterBy(getViewer().role)?.body || "";
      document.querySelector("#letter-editor-title").textContent = `Escrever para ${getViewer().beloved}`;
      feedback.openDialog(editor);
    });
    document.querySelectorAll("[data-close-letter-editor]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(editor)));
    form.addEventListener("submit", event => {
      event.preventDefault();
      const body = form.elements.body.value.trim();
      if (!body) return;
      const role = getViewer().role;
      const now = new Date().toISOString();
      store.update(state => {
        const letter = state.letters
          .filter(item => authorOf(item) === role)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
        if (letter) Object.assign(letter, { body: body.slice(0, 4000), updatedAt: now, author: role });
        else state.letters.push({ id: `letter-${role}-${Date.now()}`, body: body.slice(0, 4000), author: role, createdAt: now, updatedAt: now });
      }, { feature: "letters" });
      feedback.toast("Carta guardada no cofre");
      view = "mine";
      render();
      feedback.closeDialog(editor);
      feedback.openDialog(dialog);
    });
    render();
  }

  return { initialize, render, open, letterBy };
}
