import { escapeHTML } from "../../core/formatters.js";
import { buildRetrospective } from "./retrospective.js";

export function createStoryFeature({ store, feedback, getProfile, getViewer, letters }) {
  const dialog = document.querySelector("#story-dialog");
  const content = document.querySelector("#story-content");
  const backdrop = document.querySelector("#story-backdrop");
  const progress = document.querySelector("#story-progress");
  const nextButton = document.querySelector("#story-next");
  const backButton = document.querySelector("#story-back");
  let chapters = [];
  let index = 0;
  let changing = false;

  function draw() {
    const chapter = chapters[index];
    document.querySelector("#story-eyebrow").textContent = chapter.eyebrow;
    const title = document.querySelector("#story-text");
    title.classList.toggle("story-quote", Boolean(chapter.quote));
    title.innerHTML = chapter.quote
      ? `“${escapeHTML(chapter.quote)}”`
      : `${escapeHTML(chapter.title)}${chapter.emphasis ? ` <em>${escapeHTML(chapter.emphasis)}</em>` : ""}`;
    const stats = document.querySelector("#story-stats");
    stats.hidden = !chapter.stats?.length;
    stats.innerHTML = (chapter.stats || []).map(stat => `<span><strong>${escapeHTML(String(stat.value))}</strong><small>${escapeHTML(stat.label)}</small></span>`).join("");
    document.querySelector("#story-subtext").textContent = chapter.text || "";
    const actions = document.querySelector("#story-actions");
    actions.hidden = !chapter.action;
    actions.innerHTML = chapter.action ? `<button class="button primary" type="button" data-story-action="${escapeHTML(chapter.action.type)}">${escapeHTML(chapter.action.label)}</button>` : "";

    backdrop.classList.toggle("has-photo", Boolean(chapter.photo));
    backdrop.style.backgroundImage = chapter.photo ? `url("${chapter.photo}")` : "";
    progress.querySelectorAll("span").forEach((segment, position) => {
      segment.classList.toggle("done", position < index);
      segment.classList.toggle("current", position === index);
    });
    document.querySelector("#story-counter").textContent = `${String(index + 1).padStart(2, "0")} / ${String(chapters.length).padStart(2, "0")}`;
    backButton.hidden = index === 0;
    nextButton.textContent = index === chapters.length - 1 ? "Voltar ao nosso céu" : "Continuar →";
  }

  function go(step) {
    const target = index + step;
    if (changing || target < 0) return;
    if (target >= chapters.length) {
      feedback.closeDialog(dialog);
      return;
    }
    changing = true;
    content.classList.add("changing");
    setTimeout(() => { index = target; draw(); }, 240);
    setTimeout(() => { content.classList.remove("changing"); changing = false; }, 520);
  }

  function open() {
    const viewer = getViewer();
    chapters = buildRetrospective({
      state: store.getState(),
      profile: getProfile(),
      viewer,
      hasLetterForViewer: Boolean(letters.letterBy(viewer.belovedRole))
    });
    index = 0;
    progress.innerHTML = chapters.map(() => "<span></span>").join("");
    draw();
    feedback.openDialog(dialog);
    setTimeout(() => nextButton.focus(), 80);
  }

  function initialize() {
    document.querySelectorAll("[data-open-story]").forEach(button => button.addEventListener("click", open));
    nextButton.addEventListener("click", () => go(1));
    backButton.addEventListener("click", () => go(-1));
    document.querySelector("[data-close-story]").addEventListener("click", () => feedback.closeDialog(dialog));
    document.querySelector("#story-actions").addEventListener("click", event => {
      if (event.target.closest("[data-story-action='letter']")) {
        feedback.closeDialog(dialog);
        letters.open("received");
      }
    });
    dialog.addEventListener("keydown", event => {
      if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
    });
  }

  return { initialize, open };
}
