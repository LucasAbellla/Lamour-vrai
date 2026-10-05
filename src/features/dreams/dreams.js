import { escapeHTML } from "../../core/formatters.js";

export function createDreamsFeature({ store, feedback }) {
  function render() {
    const dreams = store.getState().dreams;
    const grid = document.querySelector("#dream-grid");
    document.querySelector("#dream-empty").hidden = dreams.length > 0;
    grid.innerHTML = dreams.map((dream, index) => `<article class="dream-card ${dream.realized ? "realized" : ""}" data-number="${String(index + 1).padStart(2, "0")}">
      <span class="dream-status">${dream.realized ? "vivemos" : escapeHTML(dream.status || "sonhando")}</span>
      <h3>${escapeHTML(dream.title)}</h3>
      <p>${escapeHTML(dream.description)}</p>
      <button type="button" data-dream="${escapeHTML(dream.id)}">${dream.realized ? "Voltar para os planos" : "Marcar como vivido →"}</button>
    </article>`).join("");
  }

  function initialize() {
    const dialog = document.querySelector("#dream-dialog");
    const form = document.querySelector("#dream-form");
    document.querySelectorAll("[data-open-dream]").forEach(button => button.addEventListener("click", () => {
      form.reset();
      document.querySelector("#dream-form-error").textContent = "";
      feedback.openDialog(dialog);
    }));
    document.querySelectorAll("[data-close-dream]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(dialog)));
    form.addEventListener("submit", event => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      const description = form.elements.description.value.trim();
      if (!title || !description) {
        document.querySelector("#dream-form-error").textContent = "Dê um nome e algumas palavras para este sonho.";
        return;
      }
      store.update(state => state.dreams.push({
        id: `dream-${Date.now()}`,
        title: title.slice(0, 70),
        description: description.slice(0, 240),
        status: form.elements.status.value,
        realized: false,
        createdAt: new Date().toISOString()
      }), { feature: "dreams" });
      feedback.toast("Um novo sonho entrou nos planos");
      render();
      feedback.closeDialog(dialog);
    });
    document.querySelector("#dream-grid").addEventListener("click", event => {
      const button = event.target.closest("[data-dream]");
      if (!button) return;
      const dream = store.getState().dreams.find(item => item.id === button.dataset.dream);
      if (!dream) return;
      store.update(() => { dream.realized = !dream.realized; }, { feature: "dreams" });
      feedback.toast(dream.realized ? "Um sonho virou memória" : "Sonho devolvido aos planos");
      render();
    });
    render();
  }

  return { initialize, render };
}
