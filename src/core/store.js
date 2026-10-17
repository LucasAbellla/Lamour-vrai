import { createEmptyState } from "../data/defaults.js";

function normalizeState(candidate) {
  const empty = createEmptyState();
  if (!candidate || typeof candidate !== "object") return empty;
  return {
    schemaVersion: 2,
    memories: Array.isArray(candidate.memories) ? candidate.memories : [],
    dreams: Array.isArray(candidate.dreams) ? candidate.dreams : [],
    capsules: Array.isArray(candidate.capsules) ? candidate.capsules : [],
    letters: Array.isArray(candidate.letters) ? candidate.letters : []
  };
}

export function createStore(namespace, options = {}) {
  const storageKey = `${namespace}-data-v2`;
  const legacyKey = `${namespace}-data-v1`;
  const listeners = new Set();
  const localPersistence = options.localPersistence !== false;
  let state = options.initialState ? normalizeState(options.initialState) : load();
  let lastSaved = JSON.stringify(state);
  let lastRemoteSave = Promise.resolve();
  let unsubscribeRemote = null;

  function load() {
    try {
      const current = localStorage.getItem(storageKey);
      if (current) return normalizeState(JSON.parse(current));
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        const migrated = normalizeState(JSON.parse(legacy));
        localStorage.setItem(storageKey, JSON.stringify(migrated));
        return migrated;
      }
    } catch (_) {}
    return createEmptyState();
  }

  // Se o navegador recusar a gravação, o estado volta ao último salvo para não exibir algo que se perderia.
  function persist() {
    if (!localPersistence) return;
    const serialized = JSON.stringify(state);
    try {
      localStorage.setItem(storageKey, serialized);
      lastSaved = serialized;
    } catch (error) {
      state = normalizeState(JSON.parse(lastSaved));
      const quotaExceeded = error?.name === "QuotaExceededError" || error?.code === 22;
      throw new Error(quotaExceeded
        ? "O espaço deste navegador acabou. Exporte um backup ou remova algumas fotografias antes de continuar."
        : "Não foi possível salvar neste dispositivo.");
    }
  }

  function persistRemote(meta) {
    if (!options.persist) return;
    lastRemoteSave = Promise.resolve(options.persist(structuredClone(state), meta));
    lastRemoteSave.catch(() => {});
  }

  function notify(meta = {}) {
    listeners.forEach(listener => listener(state, meta));
  }

  return {
    getState: () => state,
    update(mutator, meta = {}) {
      mutator(state);
      persist();
      persistRemote(meta);
      notify(meta);
      return state;
    },
    replace(nextState, meta = {}) {
      state = normalizeState(nextState);
      persist();
      if (!meta.remote) persistRemote(meta);
      notify(meta);
      return state;
    },
    // Resolve quando a última gravação no cofre terminar; rejeita se ela falhar.
    whenSaved: () => lastRemoteSave,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot() {
      return structuredClone(state);
    },
    connectRemote() {
      if (!options.subscribeRemote || unsubscribeRemote) return;
      unsubscribeRemote = options.subscribeRemote(async () => {
        if (!options.reloadRemote) return;
        state = normalizeState(await options.reloadRemote());
        notify({ remote: true });
      });
    },
    destroy() {
      unsubscribeRemote?.();
      unsubscribeRemote = null;
      listeners.clear();
    }
  };
}
