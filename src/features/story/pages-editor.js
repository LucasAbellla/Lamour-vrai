import { escapeHTML, formatDate, formatEmphasis } from "../../core/formatters.js";
import { dataUrlToBlob } from "../../core/media.js";
import { preparePhotoFile } from "../../core/photos.js";

// Quem preparou o espaço escreve as páginas de "Revisitar o primeiro ano": a data, a frase principal,
// um texto menor e a imagem de fundo. Tudo vai para o cofre; nada disso vive no código.
export function createPagesEditor({ auth, feedback, getProfile, getViewer, library, onProfileChanged, story }) {
  const dialog = document.querySelector("#pages-dialog");
  const form = document.querySelector("#pages-form");
  const list = document.querySelector("#pages-list");
  const error = document.querySelector("#pages-form-error");
  const saveButton = document.querySelector("#save-page");
  const photoLabel = form.querySelector(".photo-field strong");
  let editingId = "";
  let confirmingRemoval = "";

  const pages = () => getProfile().pages || [];

  function renderList() {
    list.hidden = !pages().length;
    list.innerHTML = pages().map(page => `<li class="${page.id === editingId ? "editing" : ""}">
        <div><small>${escapeHTML(formatDate(page.date))}${page.photo ? " · com imagem" : ""}</small><strong>${formatEmphasis(page.title)}</strong></div>
        <button class="text-link" type="button" data-edit-page="${escapeHTML(page.id)}">Editar</button>
        <button class="text-link" type="button" data-remove-page="${escapeHTML(page.id)}">${confirmingRemoval === page.id ? "Confirmar" : "Remover"}</button>
      </li>`).join("");
  }

  function reset() {
    editingId = "";
    confirmingRemoval = "";
    form.reset();
    photoLabel.textContent = "Escolher a imagem de fundo";
    saveButton.textContent = "Guardar página";
    error.textContent = "";
  }

  function edit(page) {
    editingId = page.id;
    form.elements.date.value = page.date;
    form.elements.title.value = page.title;
    form.elements.text.value = page.text;
    form.elements.photo.value = "";
    photoLabel.textContent = page.photo ? "Manter a imagem atual ou escolher outra" : "Escolher a imagem de fundo";
    saveButton.textContent = "Salvar alterações";
    error.textContent = "";
    renderList();
    form.elements.title.focus();
  }

  function open() {
    reset();
    renderList();
    feedback.openDialog(dialog);
    setTimeout(() => form.elements.date.focus(), 100);
  }

  async function save(nextPages, message) {
    const profile = await auth.updateProfile({ pages: nextPages });
    onProfileChanged(profile);
    feedback.toast(message);
  }

  async function remove(page) {
    if (confirmingRemoval !== page.id) {
      confirmingRemoval = page.id;
      renderList();
      return;
    }
    try {
      await save(pages().filter(item => item.id !== page.id), "Página removida");
      if (page.photo) {
        library.forget(page.id);
        await auth.getMedia()?.remove(page.id, page.photo).catch(() => {});
      }
      if (editingId === page.id) reset();
    } catch (issue) {
      error.textContent = issue.message;
    }
    confirmingRemoval = "";
    renderList();
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.textContent = "";
    const current = pages().find(page => page.id === editingId);
    const id = current?.id || crypto.randomUUID();
    const file = form.elements.photo.files[0];
    const label = saveButton.textContent;
    saveButton.disabled = true;
    try {
      let photo = current?.photo || null;
      if (file) {
        saveButton.textContent = "Preparando a imagem…";
        const prepared = await preparePhotoFile(file);
        saveButton.textContent = "Cifrando e enviando…";
        photo = await auth.getMedia().save(id, dataUrlToBlob(prepared.dataUrl));
        library.forget(id);
      }
      const page = { id, date: form.elements.date.value, title: form.elements.title.value, text: form.elements.text.value, photo };
      const nextPages = current ? pages().map(item => item.id === id ? page : item) : [...pages(), page];
      await save(nextPages, current ? "Página atualizada" : "Página guardada no cofre");
      reset();
      renderList();
    } catch (issue) {
      saveButton.textContent = label;
      error.textContent = issue.message;
    } finally {
      saveButton.disabled = false;
    }
  });

  list.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-page]");
    const removeButton = event.target.closest("[data-remove-page]");
    const page = pages().find(item => item.id === (editButton?.dataset.editPage || removeButton?.dataset.removePage));
    if (!page) return;
    if (editButton) edit(page);
    else void remove(page);
  });

  form.elements.photo.addEventListener("change", () => {
    const file = form.elements.photo.files[0];
    if (file) photoLabel.textContent = file.name;
  });
  document.querySelector("[data-new-page]").addEventListener("click", () => {
    reset();
    renderList();
    form.elements.date.focus();
  });
  document.querySelector("[data-preview-pages]").addEventListener("click", () => {
    feedback.closeDialog(dialog);
    story.open();
  });
  document.querySelectorAll("[data-close-pages]").forEach(button => button.addEventListener("click", () => feedback.closeDialog(dialog)));

  // Só quem preparou o espaço escreve as páginas; para a pessoa amada, elas chegam prontas.
  const canEdit = !getViewer().isPartner;
  document.querySelectorAll("[data-open-pages]").forEach(button => {
    button.hidden = !canEdit;
    button.addEventListener("click", open);
  });

  return { open, canEdit };
}
