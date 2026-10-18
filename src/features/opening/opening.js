import { escapeHTML } from "../../core/formatters.js";
import { anniversaryInfo, preludeFor, relationshipDay, toRoman } from "../../core/perspective.js";

// A capa do livro: aparece a cada vez que o cofre é aberto e se abre para revelar a biblioteca.
// Se a pessoa amada escreveu um prelúdio, ele toca antes, por cima da capa.
export function createOpening({ auth, getProfile, getViewer, onRoleChosen, openStory, prelude }) {
  const overlay = document.querySelector("#book-opening");
  const actions = document.querySelector("#book-actions");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fill() {
    const profile = getProfile();
    const viewer = getViewer();
    const { isAnniversary, completedYears, volume } = anniversaryInfo(profile);
    document.querySelector("#book-volume").textContent = isAnniversary
      ? `Volume ${toRoman(volume - 1)} completo · hoje começa o Volume ${toRoman(volume)}`
      : `Volume ${toRoman(volume)}`;
    document.querySelector("#book-names").innerHTML = `${escapeHTML(viewer.self)} <span>&amp;</span> ${escapeHTML(viewer.beloved)}`;
    document.querySelector("#book-chapter").textContent = `Capítulo ${relationshipDay(profile)}`;
    const dedication = document.querySelector("#book-dedication");
    dedication.hidden = !profile.dedication;
    dedication.textContent = profile.dedication ? `“${profile.dedication}”` : "";

    const greeting = document.querySelector("#book-greeting");
    if (auth.canChooseRole) {
      greeting.textContent = isAnniversary ? `Hoje fazemos ${completedYears === 1 ? "um ano" : `${completedYears} anos`}. Quem está abrindo o livro?` : "Quem está abrindo o livro hoje?";
      actions.innerHTML = [
        `<button class="button primary" type="button" data-open-book data-role="owner">Entrar como ${escapeHTML(profile.partnerOne)}</button>`,
        `<button class="button secondary" type="button" data-open-book data-role="partner">Entrar como ${escapeHTML(profile.partnerTwo)}</button>`
      ].join("");
      return;
    }
    greeting.textContent = isAnniversary
      ? `Hoje fazemos ${completedYears === 1 ? "um ano" : `${completedYears} anos`}, ${viewer.self}.`
      : `Que bom ter você aqui, ${viewer.self}.`;
    actions.innerHTML = [
      '<button class="button primary" type="button" data-open-book>Abrir o livro</button>',
      isAnniversary ? '<button class="button secondary" type="button" data-open-book data-then="story">Começar pela nossa retrospectiva</button>' : ""
    ].join("");
  }

  function close(then) {
    overlay.classList.add("opening");
    setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove("visible", "opening");
      document.body.classList.remove("book-locked");
      if (then === "story") openStory();
    }, reduceMotion ? 250 : 1150);
  }

  actions.addEventListener("click", event => {
    const button = event.target.closest("[data-open-book]");
    if (!button || overlay.classList.contains("opening")) return;
    if (button.dataset.role) {
      // No modo local a identidade só é conhecida aqui; o prelúdio toca depois da escolha.
      onRoleChosen(button.dataset.role);
      const text = preludeFor(getProfile(), getViewer());
      close(button.dataset.then);
      if (text) void prelude.play(text, { continueLabel: "Entrar →" });
      return;
    }
    close(button.dataset.then);
  });

  async function show() {
    fill();
    overlay.hidden = false;
    document.body.classList.add("book-locked");
    // Força o layout antes da transição; requestAnimationFrame não roda em abas em segundo plano.
    void overlay.offsetWidth;
    overlay.classList.add("visible");
    const text = auth.canChooseRole ? null : preludeFor(getProfile(), getViewer());
    if (text) await prelude.play(text);
    setTimeout(() => actions.querySelector("button")?.focus(), text ? 100 : 700);
  }

  return { show };
}
