import { categoryNames, createEmptyState, normalizeProfile } from "../data/defaults.js";
import { safeImage } from "./formatters.js";

export const BACKUP_FEATURES = Object.freeze(["memories", "dreams", "capsules", "letters"]);
const DREAM_STATUSES = new Set(["sonhando", "planejando", "para sempre"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[\w-]{1,80}$/;

let generatedIds = 0;

function text(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function timestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : new Date().toISOString();
}

function identifier(value, prefix) {
  if (typeof value === "string" && ID_PATTERN.test(value)) return value;
  generatedIds += 1;
  return `${prefix}-import-${Date.now()}-${generatedIds}`;
}

function validDate(value) {
  return typeof value === "string" && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`));
}

const normalizers = {
  memories(item) {
    const title = text(item.title, 70);
    const description = text(item.description, 300);
    if (item.demo || !title || !description || !validDate(item.date)) return null;
    return {
      id: identifier(item.id, "memory"),
      title,
      date: item.date,
      category: Object.hasOwn(categoryNames, item.category) ? item.category : "cotidiano",
      description,
      favorite: item.favorite === true,
      photo: safeImage(item.photo),
      createdAt: timestamp(item.createdAt),
      updatedAt: timestamp(item.updatedAt || item.createdAt)
    };
  },
  dreams(item) {
    const title = text(item.title, 70);
    const description = text(item.description, 240);
    if (!title || !description) return null;
    return {
      id: identifier(item.id, "dream"),
      title,
      description,
      status: DREAM_STATUSES.has(item.status) ? item.status : "sonhando",
      realized: item.realized === true,
      createdAt: timestamp(item.createdAt)
    };
  },
  capsules(item) {
    const title = text(item.title, 70);
    const message = text(item.message, 1200);
    if (!title || !message || !validDate(item.unlockDate)) return null;
    return {
      id: identifier(item.id, "capsule"),
      title,
      message,
      unlockDate: item.unlockDate,
      createdAt: timestamp(item.createdAt),
      opened: item.opened === true
    };
  },
  letters(item) {
    const body = text(item.body, 4000);
    if (!body) return null;
    return {
      id: identifier(item.id, "letter"),
      body,
      createdAt: timestamp(item.createdAt),
      updatedAt: timestamp(item.updatedAt || item.createdAt)
    };
  }
};

// Lê um backup exportado pelo próprio aplicativo (v1 ou v2) e descarta tudo que não tiver o formato esperado.
export function parseBackup(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = null;
    }
  }
  if (!data || typeof data !== "object" || !BACKUP_FEATURES.some(feature => Array.isArray(data[feature]))) {
    throw new Error("Esse arquivo não parece ser um backup do L'amour vrai.");
  }
  const state = createEmptyState();
  let discarded = 0;
  for (const feature of BACKUP_FEATURES) {
    const seen = new Set();
    for (const item of Array.isArray(data[feature]) ? data[feature] : []) {
      const normalized = item && typeof item === "object" ? normalizers[feature](item) : null;
      if (!normalized || seen.has(normalized.id)) {
        discarded += 1;
        continue;
      }
      seen.add(normalized.id);
      state[feature].push(normalized);
    }
  }
  const profile = data.profile && typeof data.profile === "object" ? normalizeProfile(data.profile) : null;
  return { state, profile, discarded };
}

// Acrescenta somente o que ainda não existe. Registros já guardados nunca são substituídos nem removidos.
export function mergeBackup(currentState, incomingState) {
  const state = createEmptyState();
  const added = {};
  let skipped = 0;
  for (const feature of BACKUP_FEATURES) {
    const current = currentState[feature] || [];
    const existingIds = new Set(current.map(item => item.id));
    const fresh = (incomingState[feature] || []).filter(item => !existingIds.has(item.id)).map(item => ({ ...item }));
    skipped += (incomingState[feature] || []).length - fresh.length;
    state[feature] = [...current, ...fresh];
    added[feature] = fresh;
  }
  const totalAdded = BACKUP_FEATURES.reduce((sum, feature) => sum + added[feature].length, 0);
  return { state, added, skipped, totalAdded };
}

const LABELS = {
  memories: ["memória", "memórias"],
  dreams: ["sonho", "sonhos"],
  capsules: ["cápsula", "cápsulas"],
  letters: ["carta", "cartas"]
};

export function describeCounts(counts) {
  const parts = BACKUP_FEATURES
    .filter(feature => counts[feature] > 0)
    .map(feature => `${counts[feature]} ${LABELS[feature][counts[feature] === 1 ? 0 : 1]}`);
  if (!parts.length) return "nenhum registro";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

export function countItems(state) {
  return Object.fromEntries(BACKUP_FEATURES.map(feature => [feature, (state[feature] || []).length]));
}

// Leva um backup para o store atual (no modo seguro, para o cofre cifrado) e espera a gravação terminar.
export async function importBackupIntoStore({ store, backup, preparePhoto = async photo => photo, onProgress = () => {} }) {
  const merged = mergeBackup(store.getState(), backup.state);
  const result = { added: countItems(merged.added), skipped: merged.skipped, totalAdded: merged.totalAdded };
  if (!merged.totalAdded) return result;

  const withPhotos = merged.added.memories.filter(memory => memory.photo);
  for (const [index, memory] of withPhotos.entries()) {
    onProgress({ stage: "photos", current: index + 1, total: withPhotos.length });
    try {
      memory.photo = safeImage(await preparePhoto(memory.photo)) || memory.photo;
    } catch (_) {
      // Se a fotografia não puder ser reduzida, ela segue no tamanho original.
    }
  }

  onProgress({ stage: "saving" });
  store.replace(merged.state, { feature: "backup" });
  await store.whenSaved();
  return result;
}
