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

export function createStore(namespace) {
  const storageKey = `${namespace}-data-v2`;
  const legacyKey = `${namespace}-data-v1`;
  const listeners = new Set();
  let state = load();

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

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function notify(meta = {}) {
    listeners.forEach(listener => listener(state, meta));
  }

  return {
    getState: () => state,
    update(mutator, meta = {}) {
      mutator(state);
      persist();
      notify(meta);
      return state;
    },
    replace(nextState, meta = {}) {
      state = normalizeState(nextState);
      persist();
      notify(meta);
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot() {
      return structuredClone(state);
    }
  };
}
