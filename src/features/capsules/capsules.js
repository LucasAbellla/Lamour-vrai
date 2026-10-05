import { escapeHTML, formatDate } from "../../core/formatters.js";

function capsuleStatus(capsule) {
  const unlock = new Date(`${capsule.unlockDate}T00:00:00`);
  const now = new Date();
  const available = !Number.isNaN(unlock.getTime()) && unlock <= now;
  return { available, days: available ? 0 : Math.ceil((unlock - now) / 86400000) };
}

export function createCapsulesFeature({ store, feedback }) {
  function render() {
    const capsules = store.getState().capsules;
    const grid = document.querySelector("#capsule-grid");
    document.querySelector("#capsule-empty").hidden = capsules.length > 0;
    grid.innerHTML = [...capsules]
      .sort((a, b) => new Date(a.unlockDate) - new Date(b.unlockDate))
      .map(capsule => {
        const status = capsuleStatus(capsule);
        const stateLabel = status.available
          ? (capsule.opened ? "aberta" : "pronta para abrir")
          : `selada · ${status.days} ${status.days === 1 ? "dia" : "dias"}`;
        return `<article class="capsule-card ${status.available ? "available" : ""}">
          <span class="capsule-state">${escapeHTML(stateLabel)}</span>
          <h3>${escapeHTML(capsule.title)}</h3>
          <p>${status.available
            ? "A data chegou. Esta mensagem já pode ser revisitada."
            : `Guardada até ${escapeHTML(formatDate(capsule.unlockDate))}.`}</p>
          <button type="button" data-open-capsule-id="${escapeHTML(capsule.id)}" ${status.available ? "" : "disabled"}>${status.available ? "Abrir mensagem →" : "Ainda não é hora"}</button>
        </article>`;
      }).join("");
  }

  function initialize() {
    const dialog = document.querySelector("#capsule-dialog");
    const reader = document.querySelector("#capsule-reader-dialog");
    const form = document.querySelector("#capsule-form");
    const dateField = form.elements.unlockDate;
    const prepare = () => {
      form.reset();
      const suggested = new Date();
      suggested.setMonth(suggested.getMonth() + 1);
      dateField.min = new Date().toISOString().slice(0, 10);
      dateField.value = suggested.toISOString().slice(0, 10);
      document.querySelector("#capsule-form-error").textContent = "";
      feedback.openDialog(dialog);
    };
    document.querySelectorAll("[data-open-capsule]").forEach(button => button.addEventListener("click", prepare));
    document.querySelectorAll("[data-close-capsule]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(dialog)));
    form.addEventListener("submit", event => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      const message = form.elements.message.value.trim();
      const unlockDate = dateField.value;
      if (!title || !message || !unlockDate) {
        document.querySelector("#capsule-form-error").textContent = "Preencha o título, a data e a mensagem.";
        return;
      }
      store.update(state => state.capsules.push({
        id: `capsule-${Date.now()}`,
        title: title.slice(0, 70),
        message: message.slice(0, 1200),
        unlockDate,
        createdAt: new Date().toISOString(),
        opened: false
      }), { feature: "capsules" });
      feedback.toast("Cápsula selada até o momento escolhido");
      render();
      feedback.closeDialog(dialog);
      document.querySelector("#capsulas").scrollIntoView({ behavior: "smooth" });
    });
    document.querySelector("#capsule-grid").addEventListener("click", event => {
      const trigger = event.target.closest("[data-open-capsule-id]");
      if (!trigger) return;
      const capsule = store.getState().capsules.find(item => item.id === trigger.dataset.openCapsuleId);
      if (!capsule || !capsuleStatus(capsule).available) return;
      store.update(() => { capsule.opened = true; }, { feature: "capsules" });
      render();
      document.querySelector("#capsule-reader-date").textContent = `Guardada para ${formatDate(capsule.unlockDate)}`;
      document.querySelector("#capsule-reader-title").textContent = capsule.title;
      document.querySelector("#capsule-reader-message").textContent = capsule.message;
      feedback.openDialog(reader);
    });
    document.querySelector("[data-close-capsule-reader]").addEventListener("click", () => feedback.closeDialog(reader));
    render();
  }

  return { initialize, render };
}
