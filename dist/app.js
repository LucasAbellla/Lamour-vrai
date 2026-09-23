// ===== PERSONALIZE A PARTIR DAQUI =====
const relationship = {
  girlfriendName: "Sofia",
  boyfriendName: "Lucas",
  nickname: "minha ursinha",
  relationshipStart: "2025-10-31T00:00:00",
  anniversaryMonth: 9,
  anniversaryDay: 31,
  anniversaryNumber: 1
};

const initialMemories = [
  {
    id: "demo-start",
    title: "Onde nossa história começa",
    date: "2025-10-31",
    category: "especial",
    description: "Este primeiro espaço está pronto para receber a memória real do dia em que vocês começaram.",
    favorite: true,
    photo: "",
    demo: true
  },
  {
    id: "demo-small",
    title: "Um momento simples",
    date: "2026-02-15",
    category: "cotidiano",
    description: "Troque este exemplo por uma conversa, uma risada ou qualquer detalhe que tenha virado parte de vocês.",
    favorite: false,
    photo: "",
    demo: true
  },
  {
    id: "demo-distance",
    title: "Uma lembrança da distância",
    date: "2026-06-08",
    category: "distancia",
    description: "Este cartão pode guardar um aeroporto, uma despedida ou a alegria de finalmente se encontrar outra vez.",
    favorite: true,
    photo: "",
    demo: true
  }
];

const initialDreams = [
  { id: "home", title: "Nossa casa", description: "A porta que um dia vai substituir todos os aeroportos.", status: "sonhando", realized: false },
  { id: "sunday", title: "Domingos comuns", description: "Acordar sem pressa e transformar rotina em companhia.", status: "sonhando", realized: false },
  { id: "trip", title: "Novos lugares", description: "Conhecer o mundo e continuar escolhendo voltar um para o outro.", status: "planejando", realized: false },
  { id: "anniversaries", title: "Outros aniversários", description: "Continuar somando memórias, anos e versões de nós.", status: "para sempre", realized: false }
];
const initialCapsules = [];
// ===== FIM DA PERSONALIZAÇÃO PRINCIPAL =====

const STORAGE_KEY = "lamour-vrai-data-v1";
const categoryNames = { cotidiano: "Cotidiano", encontro: "Encontro", distancia: "Distância", viagem: "Viagem", especial: "Data especial" };
const starPositions = [
  [14,24],[31,14],[52,27],[72,13],[86,34],[68,48],[44,43],[23,52],[12,73],[35,76],[58,67],[82,76],[69,88],[43,91],[91,56]
];
let state = loadState();
let activeFilter = "all";
let memorySearch = "";
let memoryView = "album";
let editingMemoryId = "";
let openMemoryDetailById = () => {};
let openMemoryFormForEdit = () => {};
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.memories) && Array.isArray(saved.dreams)) {
      return { memories: saved.memories, dreams: saved.dreams, capsules: Array.isArray(saved.capsules) ? saved.capsules : [] };
    }
  } catch (_) {}
  return { memories: structuredClone(initialMemories), dreams: structuredClone(initialDreams), capsules: structuredClone(initialCapsules) };
}

function saveState(message = "Alterações salvas neste dispositivo") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  showToast(message);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
}

function safeImage(value = "") {
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) ? value : "";
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function calendarDifference(start, end) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || end < start) return null;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  let cursor = new Date(start);
  cursor.setMonth(cursor.getMonth() + months);
  if (cursor > end) {
    months -= 1;
    cursor = new Date(start);
    cursor.setMonth(cursor.getMonth() + months);
  }
  const remaining = end - cursor;
  return {
    months,
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000)
  };
}

function updateTimer() {
  const values = calendarDifference(new Date(relationship.relationshipStart), new Date());
  if (!values) return;
  Object.entries(values).forEach(([unit, value]) => {
    const target = document.querySelector(`[data-unit="${unit}"]`);
    if (target && target.textContent !== String(value).padStart(2, "0")) {
      target.style.opacity = ".4";
      setTimeout(() => { target.textContent = String(value).padStart(2, "0"); target.style.opacity = "1"; }, 100);
    }
  });
}

function updateAnniversary() {
  const today = new Date();
  let next = new Date(today.getFullYear(), relationship.anniversaryMonth, relationship.anniversaryDay, 0, 0, 0);
  if (next < today) next = new Date(today.getFullYear() + 1, relationship.anniversaryMonth, relationship.anniversaryDay, 0, 0, 0);
  const days = Math.ceil((next - today) / 86400000);
  document.querySelector("#anniversary-days").textContent = days === 0 ? "hoje" : String(days).padStart(2, "0");
  document.querySelector("#anniversary-label").textContent = days === 0 ? "é o nosso aniversário" : "dias para nosso aniversário";
}

function setupAtmosphere() {
  const canvas = document.querySelector("#atmosphere-canvas");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let particles = [];
  let running = true;
  const colors = ["215,71,95", "217,138,154", "213,183,138", "246,236,238"];

  const reset = particle => {
    particle.x = Math.random() * width;
    particle.y = height + Math.random() * height * .22;
    particle.radius = Math.random() * 1.2 + .35;
    particle.speed = Math.random() * .18 + .045;
    particle.drift = (Math.random() - .5) * .08;
    particle.alpha = Math.random() * .3 + .08;
    particle.color = colors[Math.floor(Math.random() * colors.length)];
    particle.petal = Math.random() > .93;
    particle.phase = Math.random() * Math.PI * 2;
  };
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio,0,0,ratio,0,0);
    particles = Array.from({ length: width < 700 ? 34 : 66 }, () => { const item = {}; reset(item); item.y = Math.random() * height; return item; });
  };
  const draw = time => {
    if (!running) return;
    context.clearRect(0,0,width,height);
    particles.forEach(particle => {
      particle.y -= particle.speed;
      particle.x += particle.drift + Math.sin(time * .00025 + particle.phase) * .025;
      if (particle.y < -18 || particle.x < -18 || particle.x > width + 18) reset(particle);
      context.save();
      context.translate(particle.x,particle.y);
      context.rotate(Math.sin(time * .00018 + particle.phase) * .7);
      context.fillStyle = `rgba(${particle.color},${particle.alpha})`;
      context.shadowColor = `rgba(${particle.color},.18)`;
      context.shadowBlur = particle.petal ? 8 : 4;
      context.beginPath();
      if (particle.petal) context.ellipse(0,0,1.4,3.6,.5,0,Math.PI*2);
      else context.arc(0,0,particle.radius,0,Math.PI*2);
      context.fill();
      context.restore();
    });
    requestAnimationFrame(draw);
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    const shouldRun = !document.hidden;
    if (shouldRun && !running) { running = true; requestAnimationFrame(draw); }
    else if (!shouldRun) running = false;
  });
  requestAnimationFrame(draw);
}

function setupDynamicMotion() {
  const topbar = document.querySelector(".topbar");
  const progress = document.querySelector("#scroll-progress");
  const heroImage = document.querySelector(".hero > img");
  const cursor = document.querySelector("#cursor-light");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    topbar.classList.toggle("scrolled", window.scrollY > 24);
    if (!reduceMotion && heroImage && window.scrollY < window.innerHeight) heroImage.style.translate = `0 ${window.scrollY * .065}px`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;
  document.body.classList.add("pointer-active");
  window.addEventListener("pointermove", event => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    const surface = event.target.closest(".interactive-surface, .memory-card");
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    surface.style.setProperty("--pointer-x", `${x}%`);
    surface.style.setProperty("--pointer-y", `${y}%`);
    if (surface.matches("[data-tilt]")) {
      surface.style.setProperty("--tilt-x", `${((x - 50) / 50) * 1.8}deg`);
      surface.style.setProperty("--tilt-y", `${((50 - y) / 50) * 1.5}deg`);
    }
  }, { passive: true });
  document.addEventListener("pointerout", event => {
    const surface = event.target.closest?.("[data-tilt]");
    if (!surface || surface.contains(event.relatedTarget)) return;
    surface.style.setProperty("--tilt-x", "0deg");
    surface.style.setProperty("--tilt-y", "0deg");
  });
}

function renderMemories() {
  const grid = document.querySelector("#memory-grid");
  grid.classList.toggle("timeline-view", memoryView === "timeline");
  const filtered = [...state.memories]
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .filter(memory => activeFilter === "all" || (activeFilter === "favorite" ? memory.favorite : memory.category === activeFilter))
    .filter(memory => !memorySearch || `${memory.title} ${memory.description} ${categoryNames[memory.category] || ""}`.toLocaleLowerCase("pt-BR").includes(memorySearch));
  grid.innerHTML = filtered.map((memory, index) => {
    const photo = safeImage(memory.photo);
    return `<article class="memory-card" data-id="${escapeHTML(memory.id)}" style="--card-delay:${Math.min(index * 55,275)}ms">
      <button class="memory-open" type="button" data-memory-detail="${escapeHTML(memory.id)}" aria-label="Abrir memória: ${escapeHTML(memory.title)}"></button>
      <div class="memory-photo">${photo ? `<img src="${photo}" alt="Fotografia da memória ${escapeHTML(memory.title)}" loading="lazy">` : `<div class="memory-placeholder" aria-hidden="true">${memory.demo ? "✦" : "◇"}</div>`}</div>
      <button class="favorite-button ${memory.favorite ? "active" : ""}" type="button" data-favorite="${escapeHTML(memory.id)}" aria-label="${memory.favorite ? "Remover dos favoritos" : "Marcar como favorita"}" title="Favoritar">${memory.favorite ? "♥" : "♡"}</button>
      <div class="memory-body">
        <div class="memory-meta"><span>${memory.demo ? "Exemplo editável" : escapeHTML(categoryNames[memory.category] || "Memória")}</span><time datetime="${escapeHTML(memory.date)}">${escapeHTML(formatDate(memory.date))}</time></div>
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

function renderConstellation() {
  const sky = document.querySelector("#sky");
  const camera = document.querySelector("#sky-camera");
  sky.querySelectorAll(".star").forEach(star => star.remove());
  const points = state.memories.slice(0, starPositions.length).map((memory, index) => {
    const [x,y] = starPositions[index];
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star";
    star.style.left = `calc(${x}% - 17px)`;
    star.style.top = `calc(${y}% - 17px)`;
    star.style.setProperty("--star-size", `${memory.favorite ? 8 : 5 + (index % 3)}px`);
    star.setAttribute("aria-label", `Abrir memória: ${memory.title}`);
    star.addEventListener("click", () => selectStar(star, memory));
    camera.appendChild(star);
    return [x * 7, y * 5.6];
  });
  document.querySelector("#star-path").setAttribute("d", points.length ? `M ${points.map(([x,y]) => `${x} ${y}`).join(" L ")}` : "");
}

function selectStar(star, memory) {
  document.querySelectorAll(".star").forEach(item => item.classList.remove("active"));
  star.classList.add("active");
  const panel = document.querySelector("#selected-star");
  panel.querySelector("strong").textContent = memory.title;
  panel.querySelector("span").textContent = `${formatDate(memory.date)} · ${memory.description}`;
}

function renderDreams() {
  document.querySelector("#dream-grid").innerHTML = state.dreams.map((dream,index) => `<article class="dream-card ${dream.realized ? "realized" : ""}" data-number="${String(index + 1).padStart(2,"0")}">
    <span class="dream-status">${dream.realized ? "vivemos" : escapeHTML(dream.status)}</span>
    <h3>${escapeHTML(dream.title)}</h3>
    <p>${escapeHTML(dream.description)}</p>
    <button type="button" data-dream="${escapeHTML(dream.id)}">${dream.realized ? "Voltar para os planos" : "Marcar como vivido →"}</button>
  </article>`).join("");
}

function capsuleStatus(capsule) {
  const unlock = new Date(`${capsule.unlockDate}T00:00:00`);
  const now = new Date();
  const available = !Number.isNaN(unlock.getTime()) && unlock <= now;
  const days = available ? 0 : Math.ceil((unlock - now) / 86400000);
  return { available, days };
}

function renderCapsules() {
  const grid = document.querySelector("#capsule-grid");
  const empty = document.querySelector("#capsule-empty");
  empty.hidden = state.capsules.length > 0;
  grid.innerHTML = [...state.capsules].sort((a,b) => new Date(a.unlockDate) - new Date(b.unlockDate)).map(capsule => {
    const status = capsuleStatus(capsule);
    const stateLabel = status.available ? (capsule.opened ? "aberta" : "pronta para abrir") : `selada · ${status.days} ${status.days === 1 ? "dia" : "dias"}`;
    return `<article class="capsule-card ${status.available ? "available" : ""}">
      <span class="capsule-state">${escapeHTML(stateLabel)}</span>
      <h3>${escapeHTML(capsule.title)}</h3>
      <p>${status.available ? "A data chegou. Esta mensagem já pode ser revisitada." : `Guardada até ${escapeHTML(formatDate(capsule.unlockDate))}.`}</p>
      <button type="button" data-open-capsule-id="${escapeHTML(capsule.id)}" ${status.available ? "" : "disabled"}>${status.available ? "Abrir mensagem →" : "Ainda não é hora"}</button>
    </article>`;
  }).join("");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  document.body.classList.add("modal-open");
}

function closeDialog(dialog) {
  dialog.close();
  document.body.classList.remove("modal-open");
}

async function fileToDataURL(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 1.5 * 1024 * 1024) throw new Error("A fotografia precisa ter até 1,5 MB nesta versão.");
  return await new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
    reader.readAsDataURL(file);
  });
}

function createMemoryRecord({ title, date, category = "cotidiano", description, photo = "" }) {
  if (!title?.trim() || !description?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Título, data e descrição são obrigatórios.");
  if (!Object.hasOwn(categoryNames, category)) throw new Error("Categoria de memória inválida.");
  const memory = {
    id: `memory-${Date.now()}-${Math.random().toString(16).slice(2,7)}`,
    title: title.trim().slice(0,70),
    date,
    category,
    description: description.trim().slice(0,300),
    favorite: false,
    photo: safeImage(photo),
    demo: false
  };
  state.memories.push(memory);
  saveState("Memória guardada — uma nova estrela apareceu");
  renderMemories();
  return memory;
}

function setupMemoryForm() {
  const dialog = document.querySelector("#memory-dialog");
  const form = document.querySelector("#memory-form");
  const dateField = form.elements.date;
  const heading = form.querySelector("h2");
  const saveButton = document.querySelector("#save-memory");
  const photoLabel = form.querySelector(".photo-field strong");
  const openNew = () => {
    editingMemoryId = "";
    form.reset();
    dateField.value = new Date().toISOString().slice(0,10);
    heading.textContent = "Guardar uma memória";
    saveButton.textContent = "Guardar memória";
    photoLabel.textContent = "Adicionar uma fotografia";
    document.querySelector("#form-error").textContent = "";
    openDialog(dialog);
    setTimeout(() => form.elements.title.focus(), 100);
  };
  openMemoryFormForEdit = memory => {
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
    openDialog(dialog);
    setTimeout(() => form.elements.title.focus(), 100);
  };
  document.querySelectorAll("[data-open-memory]").forEach(button => button.addEventListener("click", openNew));
  form.querySelector('[value="cancel"]').addEventListener("click", event => { event.preventDefault(); closeDialog(dialog); });
  form.elements.photo.addEventListener("change", () => {
    const file = form.elements.photo.files[0];
    if (file) form.querySelector(".photo-field strong").textContent = file.name;
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const error = document.querySelector("#form-error");
    error.textContent = "";
    try {
      const newPhoto = await fileToDataURL(form.elements.photo.files[0]);
      if (editingMemoryId) {
        const memory = state.memories.find(item => item.id === editingMemoryId);
        if (!memory) throw new Error("Esta memória não foi encontrada.");
        const title = form.elements.title.value.trim();
        const description = form.elements.description.value.trim();
        if (!title || !description || !form.elements.date.value) throw new Error("Título, data e descrição são obrigatórios.");
        Object.assign(memory, {
          title: title.slice(0,70),
          date: form.elements.date.value,
          category: form.elements.category.value,
          description: description.slice(0,300),
          photo: newPhoto || memory.photo,
          demo: false
        });
        saveState("Memória atualizada");
        renderMemories();
      } else {
        createMemoryRecord({
          title: form.elements.title.value.trim(),
          date: form.elements.date.value,
          category: form.elements.category.value,
          description: form.elements.description.value.trim(),
          photo: newPhoto
        });
      }
      form.reset();
      dateField.value = new Date().toISOString().slice(0,10);
      photoLabel.textContent = "Adicionar uma fotografia";
      closeDialog(dialog);
      document.querySelector("#memorias").scrollIntoView({ behavior: "smooth" });
    } catch (issue) { error.textContent = issue.message; }
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
    description: "Lista as memórias que estão guardadas no L'amour vrai neste dispositivo.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      return { memories: state.memories.map(({ id,title,date,category,description,favorite }) => ({ id,title,date,category,description,favorite })) };
    }
  });
  register({
    name: "create_memory",
    title: "Guardar memória",
    description: "Guarda uma memória de texto no L'amour vrai e adiciona sua estrela à constelação.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 70 },
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        category: { type: "string", enum: Object.keys(categoryNames) },
        description: { type: "string", minLength: 1, maxLength: 300 }
      },
      required: ["title","date","category","description"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const memory = createMemoryRecord(input);
      return { id: memory.id, status: "saved", starAdded: true };
    }
  });
}

function setupStory() {
  const dialog = document.querySelector("#story-dialog");
  const content = document.querySelector("#story-content");
  const steps = [
    ["Há exatamente um ano, minha vida começou a guardar um novo tipo de memória.", "E todas elas têm um pouco de você."],
    ["Entre todas as rosas, violetas e flores chamativas…", "Eu ainda escolheria meu Lírio Vermelho."],
    ["O primeiro ano virou fotografias, cartas, aeroportos e pequenos detalhes.", "Agora, cada lembrança pode encontrar seu lugar."],
    ["Feliz 1 ano, minha ursinha.", "Eu escolheria você de novo. Lucas ♥ Sofia"]
  ];
  let index = 0;
  const draw = () => {
    document.querySelector("#story-text").textContent = steps[index][0];
    document.querySelector("#story-subtext").textContent = steps[index][1];
    document.querySelector("#story-counter").textContent = `${String(index + 1).padStart(2,"0")} / ${String(steps.length).padStart(2,"0")}`;
    document.querySelector("#story-progress").style.width = `${((index + 1) / steps.length) * 100}%`;
    document.querySelector("#story-next").textContent = index === steps.length - 1 ? "Voltar ao nosso céu" : "Continuar →";
  };
  document.querySelectorAll("[data-open-story]").forEach(button => button.addEventListener("click", () => { index = 0; draw(); openDialog(dialog); }));
  document.querySelector("#story-next").addEventListener("click", () => {
    if (index === steps.length - 1) return closeDialog(dialog);
    content.classList.add("changing");
    setTimeout(() => { index += 1; draw(); }, 260);
    setTimeout(() => content.classList.remove("changing"), 550);
  });
  document.querySelector("[data-close-story]").addEventListener("click", () => closeDialog(dialog));
}

function setupLetter() {
  const dialog = document.querySelector("#letter-dialog");
  document.querySelector("[data-open-letter]").addEventListener("click", () => openDialog(dialog));
  document.querySelector("[data-close-letter]").addEventListener("click", () => closeDialog(dialog));
}

function setupCapsules() {
  const dialog = document.querySelector("#capsule-dialog");
  const reader = document.querySelector("#capsule-reader-dialog");
  const form = document.querySelector("#capsule-form");
  const dateField = form.elements.unlockDate;
  const prepare = () => {
    form.reset();
    const suggested = new Date();
    suggested.setMonth(suggested.getMonth() + 1);
    dateField.min = new Date().toISOString().slice(0,10);
    dateField.value = suggested.toISOString().slice(0,10);
    document.querySelector("#capsule-form-error").textContent = "";
    openDialog(dialog);
    setTimeout(() => form.elements.title.focus(),100);
  };
  document.querySelectorAll("[data-open-capsule]").forEach(button => button.addEventListener("click", prepare));
  document.querySelectorAll("[data-close-capsule]").forEach(button => button.addEventListener("click", () => closeDialog(dialog)));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = form.elements.title.value.trim();
    const message = form.elements.message.value.trim();
    const unlockDate = dateField.value;
    if (!title || !message || !unlockDate) {
      document.querySelector("#capsule-form-error").textContent = "Preencha o título, a data e a mensagem.";
      return;
    }
    state.capsules.push({ id: `capsule-${Date.now()}`, title: title.slice(0,70), message: message.slice(0,1200), unlockDate, createdAt: new Date().toISOString(), opened: false });
    saveState("Cápsula selada até o momento escolhido");
    renderCapsules();
    closeDialog(dialog);
    document.querySelector("#capsulas").scrollIntoView({behavior:"smooth"});
  });
  document.querySelector("#capsule-grid").addEventListener("click", event => {
    const trigger = event.target.closest("[data-open-capsule-id]");
    if (!trigger) return;
    const capsule = state.capsules.find(item => item.id === trigger.dataset.openCapsuleId);
    if (!capsule || !capsuleStatus(capsule).available) return;
    capsule.opened = true;
    saveState("Cápsula aberta");
    renderCapsules();
    document.querySelector("#capsule-reader-date").textContent = `Guardada para ${formatDate(capsule.unlockDate)}`;
    document.querySelector("#capsule-reader-title").textContent = capsule.title;
    document.querySelector("#capsule-reader-message").textContent = capsule.message;
    openDialog(reader);
  });
  document.querySelector("[data-close-capsule-reader]").addEventListener("click", () => closeDialog(reader));
}

function setupCommandPalette() {
  const dialog = document.querySelector("#command-dialog");
  const input = document.querySelector("#command-search");
  const list = document.querySelector("#command-list");
  const empty = document.querySelector("#command-empty");
  const visibleButtons = () => [...list.querySelectorAll("button")].filter(button => !button.hidden);
  const open = () => {
    input.value = "";
    list.querySelectorAll("button").forEach(button => button.hidden = false);
    empty.hidden = true;
    openDialog(dialog);
    setTimeout(() => input.focus(),80);
  };
  const close = () => closeDialog(dialog);
  const run = command => {
    close();
    if (command === "new-memory") document.querySelector("[data-open-memory]").click();
    if (command === "surprise") document.querySelector("#surprise-memory").click();
    if (command === "capsule") document.querySelector("[data-open-capsule]").click();
    if (command === "constellation") document.querySelector("#constelacao").scrollIntoView({behavior:"smooth"});
    if (command === "story") document.querySelector("[data-open-story]").click();
    if (command === "backup") document.querySelector("#export-data").click();
  };
  document.querySelectorAll("[data-open-command]").forEach(button => button.addEventListener("click", open));
  input.addEventListener("input", () => {
    const query = input.value.trim().toLocaleLowerCase("pt-BR");
    list.querySelectorAll("button").forEach(button => button.hidden = query && !button.textContent.toLocaleLowerCase("pt-BR").includes(query));
    empty.hidden = visibleButtons().length > 0;
  });
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-command]");
    if (button) run(button.dataset.command);
  });
  input.addEventListener("keydown", event => {
    const buttons = visibleButtons();
    if (event.key === "ArrowDown" && buttons[0]) { event.preventDefault(); buttons[0].focus(); }
    if (event.key === "Enter" && buttons[0]) { event.preventDefault(); run(buttons[0].dataset.command); }
  });
  list.addEventListener("keydown", event => {
    const buttons = visibleButtons();
    const index = buttons.indexOf(document.activeElement);
    if (event.key === "ArrowDown") { event.preventDefault(); (buttons[index + 1] || buttons[0])?.focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); (buttons[index - 1] || input)?.focus(); }
    if (event.key === "Enter" && document.activeElement?.dataset.command) run(document.activeElement.dataset.command);
  });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); dialog.open ? close() : open(); }
    if (event.key === "Escape" && dialog.open) close();
  });
}

function setupMemoryDetail() {
  const dialog = document.querySelector("#memory-detail-dialog");
  const deleteDialog = document.querySelector("#delete-memory-dialog");
  const visual = document.querySelector("#memory-detail-visual");
  const favorite = document.querySelector("#memory-detail-favorite");
  let currentId = "";
  const draw = memory => {
    const photo = safeImage(memory.photo);
    visual.innerHTML = photo ? `<img src="${photo}" alt="Fotografia da memória ${escapeHTML(memory.title)}">` : `<div class="memory-placeholder" aria-hidden="true">${memory.demo ? "✦" : "◇"}</div>`;
    document.querySelector("#memory-detail-category").textContent = memory.demo ? "EXEMPLO EDITÁVEL" : (categoryNames[memory.category] || "MEMÓRIA").toUpperCase();
    document.querySelector("#memory-detail-date").textContent = formatDate(memory.date);
    document.querySelector("#memory-detail-title").textContent = memory.title;
    document.querySelector("#memory-detail-description").textContent = memory.description;
    favorite.textContent = memory.favorite ? "♥ Remover das favoritas" : "♡ Guardar como favorita";
  };
  openMemoryDetailById = id => {
    const memory = state.memories.find(item => item.id === id);
    if (!memory) return;
    currentId = memory.id;
    draw(memory);
    openDialog(dialog);
  };
  document.querySelector("#memory-grid").addEventListener("click", event => {
    const trigger = event.target.closest("[data-memory-detail]");
    if (!trigger) return;
    openMemoryDetailById(trigger.dataset.memoryDetail);
  });
  favorite.addEventListener("click", () => {
    const memory = state.memories.find(item => item.id === currentId);
    if (!memory) return;
    memory.favorite = !memory.favorite;
    saveState(memory.favorite ? "Memória adicionada às favoritas" : "Memória removida das favoritas");
    renderMemories();
    draw(memory);
  });
  document.querySelector("#memory-detail-edit").addEventListener("click", () => {
    const memory = state.memories.find(item => item.id === currentId);
    if (!memory) return;
    closeDialog(dialog);
    openMemoryFormForEdit(memory);
  });
  document.querySelector("#memory-detail-delete").addEventListener("click", () => {
    closeDialog(dialog);
    openDialog(deleteDialog);
  });
  document.querySelector("[data-cancel-delete]").addEventListener("click", () => closeDialog(deleteDialog));
  document.querySelector("[data-confirm-delete]").addEventListener("click", () => {
    state.memories = state.memories.filter(item => item.id !== currentId);
    saveState("Memória excluída da coleção e da constelação");
    renderMemories();
    closeDialog(deleteDialog);
  });
  document.querySelector("[data-close-memory-detail]").addEventListener("click", () => closeDialog(dialog));
}

function setupSkyControls() {
  const camera = document.querySelector("#sky-camera");
  const label = document.querySelector("#sky-zoom-label");
  let scale = 1;
  const apply = () => {
    camera.style.setProperty("--sky-scale", scale);
    label.textContent = `${Math.round(scale * 100)}%`;
  };
  document.querySelectorAll("[data-sky-zoom]").forEach(button => button.addEventListener("click", () => {
    scale += button.dataset.skyZoom === "in" ? .1 : -.1;
    scale = Math.max(.8,Math.min(1.3,Math.round(scale * 10) / 10));
    apply();
  }));
  document.querySelector("[data-sky-reset]").addEventListener("click", () => { scale = 1; apply(); });
}

function setupInteractions() {
  document.querySelector("#memory-grid").addEventListener("click", event => {
    const button = event.target.closest("[data-favorite]");
    if (!button) return;
    const memory = state.memories.find(item => item.id === button.dataset.favorite);
    if (!memory) return;
    memory.favorite = !memory.favorite;
    saveState(memory.favorite ? "Memória adicionada às favoritas" : "Memória removida das favoritas");
    renderMemories();
  });
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(item => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderMemories();
  }));
  document.querySelector("#memory-search").addEventListener("input", event => {
    memorySearch = event.target.value.trim().toLocaleLowerCase("pt-BR");
    renderMemories();
  });
  document.querySelectorAll("[data-memory-view]").forEach(button => button.addEventListener("click", () => {
    memoryView = button.dataset.memoryView;
    document.querySelectorAll("[data-memory-view]").forEach(item => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderMemories();
  }));
  document.querySelector("#surprise-memory").addEventListener("click", () => {
    const real = state.memories.filter(memory => !memory.demo);
    const pool = real.length ? real : state.memories;
    if (!pool.length) return showToast("Guarde uma memória para poder ser surpreendido");
    const memory = pool[Math.floor(Math.random() * pool.length)];
    openMemoryDetailById(memory.id);
  });
  document.querySelector("#dream-grid").addEventListener("click", event => {
    const button = event.target.closest("[data-dream]");
    if (!button) return;
    const dream = state.dreams.find(item => item.id === button.dataset.dream);
    dream.realized = !dream.realized;
    saveState(dream.realized ? "Um sonho virou memória" : "Sonho devolvido aos planos");
    renderDreams();
  });
  document.querySelectorAll(".note-card").forEach(card => card.addEventListener("click", () => card.classList.toggle("open")));
  document.querySelector("#infinity").addEventListener("click", () => document.querySelector(".infinity-section").classList.toggle("revealed"));
}

function setupBackup() {
  document.querySelector("#export-data").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), relationship, ...state }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lamour-vrai-backup-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Backup preparado com carinho");
  });
  document.querySelector("#import-data").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported.memories) || !Array.isArray(imported.dreams)) throw new Error();
      state = { memories: imported.memories, dreams: imported.dreams, capsules: Array.isArray(imported.capsules) ? imported.capsules : [] };
      saveState("Backup restaurado com sucesso");
      renderMemories();
      renderDreams();
      renderCapsules();
    } catch (_) { showToast("Esse arquivo não parece ser um backup válido"); }
    event.target.value = "";
  });
}

function setupRevealAndNavigation() {
  const reveals = document.querySelectorAll(".reveal");
  reveals.forEach((item,index) => item.style.setProperty("--reveal-delay", `${(index % 3) * 70}ms`));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) reveals.forEach(item => item.classList.add("visible"));
  else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    reveals.forEach(item => observer.observe(item));
  }
  const links = document.querySelectorAll(".desktop-nav a, .mobile-nav a");
  const sections = [...document.querySelectorAll("main section[id]")];
  const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
  }), { rootMargin: "-35% 0px -55%", threshold: 0 });
  sections.forEach(section => navObserver.observe(section));
}

function setupDialogLifecycle() {
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("close", () => {
    if (![...document.querySelectorAll("dialog")].some(item => item.open)) document.body.classList.remove("modal-open");
  }));
}

function initialize() {
  updateTimer();
  updateAnniversary();
  renderMemories();
  renderDreams();
  renderCapsules();
  setupDialogLifecycle();
  setupAtmosphere();
  setupDynamicMotion();
  setupMemoryForm();
  setupStory();
  setupLetter();
  setupCapsules();
  setupCommandPalette();
  setupMemoryDetail();
  setupSkyControls();
  setupInteractions();
  setupBackup();
  setupRevealAndNavigation();
  registerWebMCP();
  setInterval(updateTimer, 1000);
}

initialize();
