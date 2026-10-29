export const categoryNames = Object.freeze({
  cotidiano: "Cotidiano",
  encontro: "Encontro",
  distancia: "Distância",
  viagem: "Viagem",
  especial: "Data especial"
});

export const starPositions = Object.freeze([
  [14,24],[31,14],[52,27],[72,13],[86,34],[68,48],[44,43],[23,52],
  [12,73],[35,76],[58,67],[82,76],[69,88],[43,91],[91,56]
]);

export function createEmptyState() {
  return {
    schemaVersion: 2,
    memories: [],
    dreams: [],
    capsules: [],
    letters: []
  };
}

// No campo de data, um ano digitado com dois dígitos ("25") vira o ano 0025; aqui ele volta a ser 2025.
export function fixShortYear(value) {
  const match = /^(\d{4})(-\d{2}-\d{2})$/.exec(value || "");
  if (!match || Number(match[1]) >= 100) return value;
  return `${2000 + Number(match[1])}${match[2]}`;
}

export function normalizeProfile(input = {}) {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(input.relationshipStart || "")
    ? fixShortYear(input.relationshipStart)
    : new Date().toISOString().slice(0, 10);

  return {
    partnerOne: String(input.partnerOne || "").trim().slice(0, 40),
    partnerTwo: String(input.partnerTwo || "").trim().slice(0, 40),
    nickname: String(input.nickname || "").trim().slice(0, 60),
    partnerNickname: String(input.partnerNickname || "").trim().slice(0, 60),
    dedication: String(input.dedication || "").trim().slice(0, 180),
    relationshipStart: start,
    anniversaryNumber: Math.max(1, Number(input.anniversaryNumber) || 1),
    preludes: {
      owner: normalizePrelude(input.preludes?.owner),
      partner: normalizePrelude(input.preludes?.partner)
    },
    pages: normalizePages(input.pages),
    songs: normalizeSongs(input.songs)
  };
}

// O prelúdio é escrito por uma pessoa para a outra: até quatro frases e uma assinatura.
export const PRELUDE_MAX_LINES = 4;
export const PRELUDE_MAX_LINE_LENGTH = 120;

export function normalizePrelude(input) {
  const source = input && typeof input === "object" ? input : {};
  const lines = (Array.isArray(source.lines) ? source.lines : [])
    .map(line => String(line ?? "").replace(/\s+/g, " ").trim().slice(0, PRELUDE_MAX_LINE_LENGTH))
    .filter(Boolean)
    .slice(0, PRELUDE_MAX_LINES);
  return { lines, signature: String(source.signature || "").trim().slice(0, 40) };
}

// Páginas da retrospectiva e músicas da rádio também vivem no perfil cifrado; o arquivo de cada uma
// (foto ou áudio) fica à parte, cifrado no armazenamento do cofre, e aqui só existe a referência a ele.
export const PAGE_MAX_COUNT = 24;
export const PAGE_TITLE_MAX_LENGTH = 160;
export const PAGE_TEXT_MAX_LENGTH = 420;
export const SONG_MAX_COUNT = 12;

const ID_PATTERN = /^[\w-]{1,64}$/;
const MIME_PATTERNS = { image: /^image\/[\w.+-]{1,40}$/, audio: /^audio\/[\w.+-]{1,40}$/ };

export function normalizeAsset(input, kind) {
  if (!input || typeof input !== "object") return null;
  const mime = String(input.mime || "");
  if (!MIME_PATTERNS[kind]?.test(mime)) return null;
  if (input.local === true) return { local: true, mime };
  const path = String(input.path || "");
  const iv = String(input.iv || "");
  if (!/^[\w-]{1,64}\/[\w-]{1,64}\.bin$/.test(path) || !/^[\w+/=]{8,64}$/.test(iv)) return null;
  return { path, iv, mime };
}

function normalizePage(input) {
  if (!input || typeof input !== "object" || !ID_PATTERN.test(String(input.id || ""))) return null;
  const date = fixShortYear(String(input.date || ""));
  const title = String(input.title || "").replace(/\s+/g, " ").trim().slice(0, PAGE_TITLE_MAX_LENGTH);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return null;
  return {
    id: String(input.id),
    date,
    title,
    text: String(input.text || "").replace(/\s+/g, " ").trim().slice(0, PAGE_TEXT_MAX_LENGTH),
    photo: normalizeAsset(input.photo, "image")
  };
}

function normalizeSong(input) {
  if (!input || typeof input !== "object" || !ID_PATTERN.test(String(input.id || ""))) return null;
  const audio = normalizeAsset(input.audio, "audio");
  const title = String(input.title || "").trim().slice(0, 80);
  if (!audio || !title) return null;
  return { id: String(input.id), title, artist: String(input.artist || "").trim().slice(0, 80), audio };
}

function normalizeList(input, normalizeItem, limit) {
  const seen = new Set();
  return (Array.isArray(input) ? input : [])
    .map(normalizeItem)
    .filter(item => item && !seen.has(item.id) && seen.add(item.id))
    .slice(0, limit);
}

export function normalizePages(input) {
  return normalizeList(input, normalizePage, PAGE_MAX_COUNT).sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeSongs(input) {
  return normalizeList(input, normalizeSong, SONG_MAX_COUNT);
}
