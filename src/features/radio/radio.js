import { escapeHTML } from "../../core/formatters.js";

// Nossa rádio: toca só as músicas que quem preparou o espaço guardou no cofre. O arquivo de cada uma fica
// cifrado no armazenamento do cofre e só é aberto neste aparelho, na hora de tocar.
const AUDIO_LIMIT_BYTES = 19 * 1024 * 1024;
const AUDIO_TYPES = Object.freeze({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg", flac: "audio/flac", webm: "audio/webm" });
const VOLUME_KEY = "lamour-vrai-radio-volume";

function readVolume() {
  try {
    const value = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(value) && value > 0 && value <= 1 ? value : .7;
  } catch (_) {
    return .7;
  }
}

// "Simples assim - A!RA e Kayno.mp3" vira nome e artista.
function describeFile(fileName) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const [title, ...artist] = base.split(/\s+-\s+/);
  return { title: title.trim(), artist: artist.join(" - ").trim() };
}

export function createRadio({ auth, feedback, getProfile, getViewer, library, onProfileChanged }) {
  const root = document.querySelector("#radio");
  const toggle = document.querySelector("#radio-toggle");
  const panel = document.querySelector("#radio-panel");
  const pillLabel = document.querySelector("#radio-pill-label");
  const playButton = document.querySelector("#radio-play");
  const volume = document.querySelector("#radio-volume");
  const list = document.querySelector("#radio-list");
  const wave = document.querySelector("#radio-wave");
  const addForm = document.querySelector("#radio-add");
  const addError = document.querySelector("#radio-error");
  const canManage = !getViewer().isPartner;
  const audio = new Audio();
  audio.preload = "auto";
  audio.volume = readVolume();
  volume.value = String(audio.volume);
  let index = 0;
  let loadedId = "";
  let wantsToPlay = false;
  let confirmingRemoval = "";
  let frame = 0;

  const songs = () => getProfile().songs || [];
  const current = () => songs()[index] || null;
  const isPlaying = () => !audio.paused && !audio.ended;

  async function load(song) {
    if (loadedId === song.id && audio.src) return;
    loadedId = song.id;
    const url = await library.url(song.id, song.audio);
    if (loadedId === song.id) audio.src = url;
  }

  function reportFailure(issue) {
    wantsToPlay = false;
    // Sem um toque recente, o navegador não deixa a música começar sozinha: a rádio pede o toque.
    if (issue?.name === "NotAllowedError") root.classList.add("asking");
    else feedback.toast(issue?.message || "Não foi possível tocar esta música.");
    render();
  }

  function start() {
    audio.loop = songs().length === 1;
    audio.play().then(() => root.classList.remove("asking"), reportFailure);
  }

  // Quando a música já está pronta, play() roda dentro do toque, como o iPhone exige.
  function play() {
    const song = current();
    if (!song) return;
    wantsToPlay = true;
    if (loadedId === song.id && audio.src) start();
    else load(song).then(() => { if (wantsToPlay && current()?.id === song.id) start(); }, reportFailure);
    render();
  }

  function pause() {
    wantsToPlay = false;
    audio.pause();
    render();
  }

  function skip(step) {
    const total = songs().length;
    if (total < 2) return;
    index = (index + step + total) % total;
    if (wantsToPlay || isPlaying()) play();
    else render();
  }

  function drawWave(now = performance.now()) {
    const context = wave.getContext("2d");
    const { width, height } = wave;
    context.clearRect(0, 0, width, height);
    const bars = 44;
    const playing = isPlaying();
    for (let bar = 0; bar < bars; bar += 1) {
      const level = playing
        ? .25 + .75 * Math.abs(Math.sin(now / 420 + bar * .55) * Math.sin(now / 910 + bar * .23))
        : .08 + .04 * Math.sin(bar * .7);
      const barHeight = Math.max(3, level * height);
      context.fillStyle = `rgba(232, 128, 152, ${playing ? .45 + level * .5 : .3})`;
      context.fillRect(bar * (width / bars) + 1, (height - barHeight) / 2, width / bars - 3, barHeight);
    }
    frame = !panel.hidden && playing ? requestAnimationFrame(drawWave) : 0;
  }

  function render() {
    const all = songs();
    if (index >= all.length) index = 0;
    const song = current();
    const playing = isPlaying() || wantsToPlay;
    root.hidden = !all.length && !canManage;
    root.classList.toggle("playing", isPlaying());
    pillLabel.textContent = isPlaying() && song ? song.title : root.classList.contains("asking") ? "Toque para ouvir" : "Nossa rádio";
    playButton.textContent = playing ? "❚❚" : "▶";
    playButton.classList.toggle("on", playing);
    playButton.setAttribute("aria-label", playing ? "Pausar" : "Tocar");
    playButton.disabled = !song;
    document.querySelector("#radio-title").textContent = song ? song.title : canManage ? "Nenhuma música ainda" : "—";
    document.querySelector("#radio-artist").textContent = song?.artist || (canManage && !song ? "Guarde a primeira logo abaixo" : "");
    const start = getProfile().relationshipStart || "";
    document.querySelector("#radio-freq").textContent = start ? `${start.slice(8, 10)}.${start.slice(5, 7)}` : "♥";
    root.querySelectorAll("[data-radio-step]").forEach(button => { button.disabled = all.length < 2; });
    list.hidden = !all.length;
    list.innerHTML = all.map((item, position) => `<li class="${position === index ? "on" : ""}">
        <button type="button" data-radio-pick="${position}"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.artist)}</small></button>
        ${canManage ? `<button class="radio-remove" type="button" data-radio-remove="${escapeHTML(item.id)}">${confirmingRemoval === item.id ? "Confirmar" : "Remover"}</button>` : ""}
      </li>`).join("");
    addForm.hidden = !canManage;
    if ("mediaSession" in navigator && song && typeof MediaMetadata === "function") {
      navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: "Nossa rádio" });
    }
    if (!frame) drawWave();
  }

  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) render();
  }

  async function removeSong(song) {
    if (confirmingRemoval !== song.id) {
      confirmingRemoval = song.id;
      render();
      return;
    }
    confirmingRemoval = "";
    if (current()?.id === song.id) {
      pause();
      audio.removeAttribute("src");
      loadedId = "";
    }
    try {
      const profile = await auth.updateProfile({ songs: songs().filter(item => item.id !== song.id) });
      onProfileChanged(profile);
      library.forget(song.id);
      await auth.getMedia()?.remove(song.id, song.audio).catch(() => {});
      feedback.toast("Música removida da rádio");
    } catch (issue) {
      feedback.toast(issue.message);
    }
    render();
  }

  addForm.elements.audio.addEventListener("change", () => {
    const file = addForm.elements.audio.files[0];
    if (!file) return;
    const described = describeFile(file.name);
    addForm.elements.title.value = described.title;
    addForm.elements.artist.value = described.artist;
    addForm.querySelector(".radio-file span").textContent = file.name;
  });

  addForm.addEventListener("submit", async event => {
    event.preventDefault();
    addError.textContent = "";
    const file = addForm.elements.audio.files[0];
    const title = addForm.elements.title.value.trim();
    const type = file?.type || AUDIO_TYPES[file?.name.split(".").pop().toLowerCase()] || "";
    if (!file) return void (addError.textContent = "Escolha o arquivo da música.");
    if (!type.startsWith("audio/")) return void (addError.textContent = "Escolha um arquivo de áudio, como MP3 ou M4A.");
    if (file.size > AUDIO_LIMIT_BYTES) return void (addError.textContent = "A música precisa ter até 19 MB.");
    if (!title) return void (addError.textContent = "Dê um nome para a música.");
    const submit = addForm.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Cifrando e enviando…";
    const id = crypto.randomUUID();
    try {
      const asset = await auth.getMedia().save(id, file.type ? file : new Blob([file], { type }));
      const profile = await auth.updateProfile({ songs: [...songs(), { id, title, artist: addForm.elements.artist.value.trim(), audio: asset }] });
      onProfileChanged(profile);
      addForm.reset();
      addForm.querySelector(".radio-file span").textContent = "＋ Escolher uma música";
      feedback.toast("Música guardada na rádio");
    } catch (issue) {
      addError.textContent = issue.message;
    } finally {
      submit.disabled = false;
      submit.textContent = "Guardar no cofre";
      render();
    }
  });

  toggle.addEventListener("click", () => {
    if (root.classList.contains("asking")) return play();
    setPanel(panel.hidden);
  });
  document.querySelector("[data-close-radio]").addEventListener("click", () => setPanel(false));
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setPanel(false);
      toggle.focus();
    }
  });
  playButton.addEventListener("click", () => (wantsToPlay || isPlaying() ? pause() : play()));
  root.querySelectorAll("[data-radio-step]").forEach(button => button.addEventListener("click", () => skip(Number(button.dataset.radioStep))));
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    try { localStorage.setItem(VOLUME_KEY, volume.value); } catch (_) {}
  });
  list.addEventListener("click", event => {
    const pick = event.target.closest("[data-radio-pick]");
    const removal = event.target.closest("[data-radio-remove]");
    if (pick) {
      index = Number(pick.dataset.radioPick);
      play();
    }
    if (removal) {
      const song = songs().find(item => item.id === removal.dataset.radioRemove);
      if (song) void removeSong(song);
    }
  });
  audio.addEventListener("ended", () => skip(1));
  ["play", "pause"].forEach(type => audio.addEventListener(type, render));

  render();

  return {
    refresh: render,
    // Busca a primeira música enquanto o prelúdio toca.
    prepare() {
      const song = current();
      if (song) load(song).catch(() => {});
    },
    // Chamado dentro do toque que encerra o prelúdio, para o navegador deixar a música começar.
    startAfterPrelude() {
      if (!songs().length) return;
      index = 0;
      play();
    },
    isPlaying
  };
}
