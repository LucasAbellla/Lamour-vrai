import { categoryNames, starPositions } from "../../data/defaults.js";
import { escapeHTML, fileToDataURL, formatDate, safeImage } from "../../core/formatters.js";

export function createMemoriesFeature({ store, feedback }) {
  let activeFilter = "all";
  let memorySearch = "";
  let memoryView = "album";
  let editingMemoryId = "";
  let currentDetailId = "";

  function renderConstellation() {
    const state = store.getState();
    const sky = document.querySelector("#sky");
    const camera = document.querySelector("#sky-camera");
    sky.querySelectorAll(".star").forEach(star => star.remove());
    const points = state.memories.slice(0, starPositions.length).map((memory, index) => {
      const [x, y] = starPositions[index];
      const star = document.createElement("button");
      star.type = "button";
      star.className = "star";
      star.style.left = `calc(${x}% - 17px)`;
      star.style.top = `calc(${y}% - 17px)`;
      star.style.setProperty("--star-size", `${memory.favorite ? 8 : 5 + (index % 3)}px`);
      star.setAttribute("aria-label", `Abrir memória: ${memory.title}`);
      star.addEventListener("click", () => {
        document.querySelectorAll(".star").forEach(item => item.classList.remove("active"));
        star.classList.add("active");
        const panel = document.querySelector("#selected-star");
        panel.querySelector("strong").textContent = memory.title;
        panel.querySelector("span").textContent = `${formatDate(memory.date)} · ${memory.description}`;
      });
      camera.appendChild(star);
      return [x * 7, y * 5.6];
    });
    document.querySelector("#star-path").setAttribute("d", points.length
      ? `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}`
      : "");
  }

  function render() {
    const state = store.getState();
    const grid = document.querySelector("#memory-grid");
    grid.classList.toggle("timeline-view", memoryView === "timeline");
    const filtered = [...state.memories]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter(memory => activeFilter === "all" || (activeFilter === "favorite" ? memory.favorite : memory.category === activeFilter))
      .filter(memory => !memorySearch || `${memory.title} ${memory.description} ${categoryNames[memory.category] || ""}`.toLocaleLowerCase("pt-BR").includes(memorySearch));

    grid.innerHTML = filtered.map((memory, index) => {
      const photo = safeImage(memory.photo);
      return `<article class="memory-card" data-id="${escapeHTML(memory.id)}" style="--card-delay:${Math.min(index * 55, 275)}ms">
        <button class="memory-open" type="button" data-memory-detail="${escapeHTML(memory.id)}" aria-label="Abrir memória: ${escapeHTML(memory.title)}"></button>
        <div class="memory-photo">${photo
          ? `<img src="${photo}" alt="Fotografia da memória ${escapeHTML(memory.title)}" loading="lazy">`
          : '<div class="memory-placeholder" aria-hidden="true">◇</div>'}</div>
        <button class="favorite-button ${memory.favorite ? "active" : ""}" type="button" data-favorite="${escapeHTML(memory.id)}" aria-label="${memory.favorite ? "Remover dos favoritos" : "Marcar como favorita"}" title="Favoritar">${memory.favorite ? "♥" : "♡"}</button>
        <div class="memory-body">
          <div class="memory-meta"><span>${escapeHTML(categoryNames[memory.category] || "Memória")}</span><time datetime="${escapeHTML(memory.date)}">${escapeHTML(formatDate(memory.date))}</time></div>
          <h3>${escapeHTML(memory.title)}</h3>
          <p>${escapeHTML(memory.description)}</p>
        </div>
      </article>`;
    }).join("");
    document.querySelector("#memory-empty").hidden = filtered.length > 0;
    document.querySelector("#memory-count").textContent = String(state.memories.length).padStart(2, "0");
    document.querySelector("#favorite-count").textContent = String(state.memories.filter(item => item.favorite).length).padStart(2, "0");
    renderConstellation();
  }

  function commit(mutator, message) {
    store.update(mutator, { feature: "memories" });
    feedback.toast(message);
    render();
  }

  function createMemoryRecord({ title, date, category = "cotidiano", description, photo = "" }) {
    if (!title?.trim() || !description?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
      throw new Error("Título, data e descrição são obrigatórios.");
    }
    if (!Object.hasOwn(categoryNames, category)) throw new Error("Categoria de memória inválida.");
    const memory = {
      id: `memory-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      title: title.trim().slice(0, 70),
      date,
      category,
      description: description.trim().slice(0, 300),
      favorite: false,
      photo: safeImage(photo),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    commit(state => state.memories.push(memory), "Memória guardada — uma nova estrela apareceu");
    return memory;
  }

  function drawDetail(memory) {
    const visual = document.querySelector("#memory-detail-visual");
    const photo = safeImage(memory.photo);
    visual.innerHTML = photo
      ? `<img src="${photo}" alt="Fotografia da memória ${escapeHTML(memory.title)}">`
      : '<div class="memory-placeholder" aria-hidden="true">◇</div>';
    document.querySelector("#memory-detail-category").textContent = (categoryNames[memory.category] || "Memória").toUpperCase();
    document.querySelector("#memory-detail-date").textContent = formatDate(memory.date);
    document.querySelector("#memory-detail-title").textContent = memory.title;
    document.querySelector("#memory-detail-description").textContent = memory.description;
    document.querySelector("#memory-detail-favorite").textContent = memory.favorite
      ? "♥ Remover das favoritas"
      : "♡ Guardar como favorita";
  }

  function openById(id) {
    const memory = store.getState().memories.find(item => item.id === id);
    if (!memory) return;
    currentDetailId = memory.id;
    drawDetail(memory);
    feedback.openDialog(document.querySelector("#memory-detail-dialog"));
  }

  function openRandom() {
    const memories = store.getState().memories;
    if (!memories.length) return feedback.toast("Guarde uma memória para poder ser surpreendido");
    openById(memories[Math.floor(Math.random() * memories.length)].id);
  }

  function setupForm() {
    const dialog = document.querySelector("#memory-dialog");
    const form = document.querySelector("#memory-form");
    const dateField = form.elements.date;
    const heading = form.querySelector("h2");
    const saveButton = document.querySelector("#save-memory");
    const photoLabel = form.querySelector(".photo-field strong");
    const openNew = () => {
      editingMemoryId = "";
      form.reset();
      dateField.value = new Date().toISOString().slice(0, 10);
      heading.textContent = "Guardar uma memória";
      saveButton.textContent = "Guardar memória";
      photoLabel.textContent = "Adicionar uma fotografia";
      document.querySelector("#form-error").textContent = "";
      feedback.openDialog(dialog);
      setTimeout(() => form.elements.title.focus(), 100);
    };
    const openForEdit = memory => {
      editingMemoryId = memory.id;
      form.elements.title.value = memory.title;
      form.elements.date.value = memory.date;
      form.elements.category.value = memory.category;
      form.elements.description.value = memory.description;
      form.elements.photo.value = "";
      heading.textContent = "Editar esta memória";
      saveButton.textContent = "Salvar alterações";
      photoLabel.textContent = memory.photo ? "Manter fotografia atual" : "Adicionar uma fotografia";
      document.querySelector("#form-error").textContent = "";
      feedback.openDialog(dialog);
    };
    document.querySelectorAll("[data-open-memory]").forEach(button => button.addEventListener("click", openNew));
    form.querySelector('[value="cancel"]').addEventListener("click", event => {
      event.preventDefault();
      feedback.closeDialog(dialog);
    });
    form.elements.photo.addEventListener("change", () => {
      const file = form.elements.photo.files[0];
      if (file) photoLabel.textContent = file.name;
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const error = document.querySelector("#form-error");
      error.textContent = "";
      try {
        const newPhoto = await fileToDataURL(form.elements.photo.files[0]);
        if (editingMemoryId) {
          const memory = store.getState().memories.find(item => item.id === editingMemoryId);
          if (!memory) throw new Error("Esta memória não foi encontrada.");
          const title = form.elements.title.value.trim();
          const description = form.elements.description.value.trim();
          if (!title || !description || !dateField.value) throw new Error("Título, data e descrição são obrigatórios.");
          commit(() => Object.assign(memory, {
            title: title.slice(0, 70),
            date: dateField.value,
            category: form.elements.category.value,
            description: description.slice(0, 300),
            photo: newPhoto || memory.photo,
            updatedAt: new Date().toISOString()
          }), "Memória atualizada");
        } else {
          createMemoryRecord({
            title: form.elements.title.value,
            date: dateField.value,
            category: form.elements.category.value,
            description: form.elements.description.value,
            photo: newPhoto
          });
        }
        form.reset();
        feedback.closeDialog(dialog);
        document.querySelector("#memorias").scrollIntoView({ behavior: "smooth" });
      } catch (issue) {
        error.textContent = issue.message;
      }
    });
    return { openNew, openForEdit };
  }

  function setupDetails(openForEdit) {
    const detailDialog = document.querySelector("#memory-detail-dialog");
    const deleteDialog = document.querySelector("#delete-memory-dialog");
    document.querySelector("#memory-grid").addEventListener("click", event => {
      const favorite = event.target.closest("[data-favorite]");
      if (favorite) {
        const memory = store.getState().memories.find(item => item.id === favorite.dataset.favorite);
        if (!memory) return;
        commit(() => { memory.favorite = !memory.favorite; }, memory.favorite
          ? "Memória removida das favoritas"
          : "Memória adicionada às favoritas");
        return;
      }
      const trigger = event.target.closest("[data-memory-detail]");
      if (trigger) openById(trigger.dataset.memoryDetail);
    });
    document.querySelector("#memory-detail-favorite").addEventListener("click", () => {
      const memory = store.getState().memories.find(item => item.id === currentDetailId);
      if (!memory) return;
      commit(() => { memory.favorite = !memory.favorite; }, memory.favorite
        ? "Memória removida das favoritas"
        : "Memória adicionada às favoritas");
      drawDetail(memory);
    });
    document.querySelector("#memory-detail-edit").addEventListener("click", () => {
      const memory = store.getState().memories.find(item => item.id === currentDetailId);
      if (!memory) return;
      feedback.closeDialog(detailDialog);
      openForEdit(memory);
    });
    document.querySelector("#memory-detail-delete").addEventListener("click", () => {
      feedback.closeDialog(detailDialog);
      feedback.openDialog(deleteDialog);
    });
    document.querySelector("[data-cancel-delete]").addEventListener("click", () => feedback.closeDialog(deleteDialog));
    document.querySelector("[data-confirm-delete]").addEventListener("click", () => {
      commit(state => { state.memories = state.memories.filter(item => item.id !== currentDetailId); }, "Memória excluída da coleção e da constelação");
      feedback.closeDialog(deleteDialog);
    });
    document.querySelector("[data-close-memory-detail]").addEventListener("click", () => feedback.closeDialog(detailDialog));
  }

  function setupControls() {
    document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(item => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      render();
    }));
    document.querySelector("#memory-search").addEventListener("input", event => {
      memorySearch = event.target.value.trim().toLocaleLowerCase("pt-BR");
      render();
    });
    document.querySelectorAll("[data-memory-view]").forEach(button => button.addEventListener("click", () => {
      memoryView = button.dataset.memoryView;
      document.querySelectorAll("[data-memory-view]").forEach(item => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      render();
    }));
    document.querySelector("#surprise-memory").addEventListener("click", openRandom);
    let scale = 1;
    const camera = document.querySelector("#sky-camera");
    const label = document.querySelector("#sky-zoom-label");
    const applyZoom = () => {
      camera.style.setProperty("--sky-scale", scale);
      label.textContent = `${Math.round(scale * 100)}%`;
    };
    document.querySelectorAll("[data-sky-zoom]").forEach(button => button.addEventListener("click", () => {
      scale += button.dataset.skyZoom === "in" ? .1 : -.1;
      scale = Math.max(.8, Math.min(1.3, Math.round(scale * 10) / 10));
      applyZoom();
    }));
    document.querySelector("[data-sky-reset]").addEventListener("click", () => {
      scale = 1;
      applyZoom();
    });
  }

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const register = tool => {
      try { void Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch (_) {}
    };
    register({
      name: "list_memories",
      title: "Listar memórias",
      description: "Lista as memórias que estão guardadas neste dispositivo.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() {
        return { memories: store.getState().memories.map(({ id, title, date, category, description, favorite }) => ({ id, title, date, category, description, favorite })) };
      }
    });
    register({
      name: "create_memory",
      title: "Guardar memória",
      description: "Guarda uma memória de texto e adiciona sua estrela à constelação.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 70 },
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          category: { type: "string", enum: Object.keys(categoryNames) },
          description: { type: "string", minLength: 1, maxLength: 300 }
        },
        required: ["title", "date", "category", "description"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const memory = createMemoryRecord(input);
        return { id: memory.id, status: "saved", starAdded: true };
      }
    });
  }

  function initialize() {
    render();
    const formControls = setupForm();
    setupDetails(formControls.openForEdit);
    setupControls();
    registerWebMCP();
  }

  return { initialize, render, openById, openRandom, createMemoryRecord };
}
