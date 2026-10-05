import { createEmptyState, normalizeProfile } from "../data/defaults.js";
import { decodeBase64, decryptBytes, decryptJson, encodeBase64, encryptBytes, encryptJson } from "./crypto-vault.js";

const FEATURE_KINDS = Object.freeze({
  memories: "memory",
  dreams: "dream",
  capsules: "capsule",
  letters: "letter"
});

function throwIfError(result, fallback) {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data;
}

function dataUrlToBytes(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) return null;
  return { mime: match[1], bytes: decodeBase64(match[2]) };
}

function bytesToDataUrl(bytes, mime) {
  return `data:${mime};base64,${encodeBase64(bytes)}`;
}

export async function fetchVaultConfig(supabase, coupleId) {
  const result = await supabase
    .from("vault_config")
    .select("kdf_salt,kdf_iterations,wrapped_key,wrapped_key_iv")
    .eq("couple_id", coupleId)
    .maybeSingle();
  const row = throwIfError(result, "Não foi possível consultar o cofre.");
  if (!row) return null;
  return {
    kdfSalt: row.kdf_salt,
    kdfIterations: row.kdf_iterations,
    wrappedKey: row.wrapped_key,
    wrappedKeyIv: row.wrapped_key_iv
  };
}

export async function insertVaultConfig(supabase, coupleId, config) {
  const result = await supabase.from("vault_config").insert({
    couple_id: coupleId,
    kdf_salt: config.kdfSalt,
    kdf_iterations: config.kdfIterations,
    wrapped_key: config.wrappedKey,
    wrapped_key_iv: config.wrappedKeyIv
  });
  throwIfError(result, "Não foi possível preparar o cofre.");
}

export function createSecureVaultRepository({ supabase, coupleId, userId, dataKey, onError }) {
  const snapshots = new Map();
  let saveQueue = Promise.resolve();
  let channel = null;

  function itemContext(kind, clientId) {
    return `${coupleId}:${kind}:${clientId}`;
  }

  async function encryptMemoryPhoto(memory) {
    const parsed = dataUrlToBytes(memory.photo);
    if (!parsed) return { ...memory, photo: "" };
    const path = `${coupleId}/${memory.id}.bin`;
    const encrypted = await encryptBytes(dataKey, parsed.bytes, `media:${coupleId}:${memory.id}`);
    parsed.bytes.fill(0);
    const upload = await supabase.storage
      .from("memory-media")
      .upload(path, decodeBase64(encrypted.ciphertext), {
        contentType: "application/octet-stream",
        cacheControl: "0",
        upsert: true
      });
    throwIfError(upload, "Não foi possível proteger a fotografia.");
    return {
      ...memory,
      photo: "",
      photoAsset: { path, iv: encrypted.iv, mime: parsed.mime }
    };
  }

  async function decryptMemoryPhoto(memory) {
    if (!memory.photoAsset?.path) return memory;
    const download = await supabase.storage.from("memory-media").download(memory.photoAsset.path);
    const blob = throwIfError(download, "Não foi possível abrir a fotografia protegida.");
    const bytes = await decryptBytes(dataKey, {
      ciphertext: encodeBase64(new Uint8Array(await blob.arrayBuffer())),
      iv: memory.photoAsset.iv
    }, `media:${coupleId}:${memory.id}`);
    const hydrated = { ...memory, photo: bytesToDataUrl(bytes, memory.photoAsset.mime) };
    delete hydrated.photoAsset;
    bytes.fill(0);
    return hydrated;
  }

  async function decryptRow(row) {
    const item = await decryptJson(dataKey, {
      ciphertext: row.ciphertext,
      iv: row.iv
    }, itemContext(row.kind, row.client_id));
    return row.kind === "memory" ? decryptMemoryPhoto(item) : item;
  }

  async function loadState() {
    const result = await supabase
      .from("vault_items")
      .select("kind,client_id,ciphertext,iv")
      .eq("couple_id", coupleId)
      .in("kind", Object.values(FEATURE_KINDS));
    const rows = throwIfError(result, "Não foi possível sincronizar o cofre.") || [];
    snapshots.clear();
    const state = createEmptyState();
    const decrypted = await Promise.all(rows.map(async row => ({ row, item: await decryptRow(row) })));
    for (const { row, item } of decrypted) {
      const feature = Object.keys(FEATURE_KINDS).find(key => FEATURE_KINDS[key] === row.kind);
      if (!feature) continue;
      state[feature].push(item);
      snapshots.set(`${row.kind}:${row.client_id}`, JSON.stringify(item));
    }
    return state;
  }

  async function saveItem(kind, item) {
    const key = `${kind}:${item.id}`;
    const serialized = JSON.stringify(item);
    if (snapshots.get(key) === serialized) return;
    const prepared = kind === "memory" ? await encryptMemoryPhoto(item) : item;
    const encrypted = await encryptJson(dataKey, prepared, itemContext(kind, item.id));
    const result = await supabase.from("vault_items").upsert({
      couple_id: coupleId,
      kind,
      client_id: item.id,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      updated_by: userId
    }, { onConflict: "couple_id,kind,client_id" });
    throwIfError(result, "Não foi possível guardar uma alteração.");
    snapshots.set(key, serialized);
  }

  async function removeMissing(kind, items) {
    const currentIds = new Set(items.map(item => item.id));
    const missing = [...snapshots.keys()]
      .filter(key => key.startsWith(`${kind}:`))
      .map(key => key.slice(kind.length + 1))
      .filter(id => !currentIds.has(id));
    if (!missing.length) return;
    const result = await supabase
      .from("vault_items")
      .delete()
      .eq("couple_id", coupleId)
      .eq("kind", kind)
      .in("client_id", missing);
    throwIfError(result, "Não foi possível remover o registro protegido.");
    const mediaPaths = missing.map(id => `${coupleId}/${id}.bin`);
    if (kind === "memory") await supabase.storage.from("memory-media").remove(mediaPaths);
    missing.forEach(id => snapshots.delete(`${kind}:${id}`));
  }

  async function saveFeature(state, feature) {
    const kind = FEATURE_KINDS[feature];
    if (!kind) return;
    const items = state[feature] || [];
    for (const item of items) await saveItem(kind, item);
    await removeMissing(kind, items);
  }

  function persist(state, meta = {}) {
    const snapshot = structuredClone(state);
    const features = FEATURE_KINDS[meta.feature] ? [meta.feature] : Object.keys(FEATURE_KINDS);
    saveQueue = saveQueue
      .then(async () => {
        for (const feature of features) await saveFeature(snapshot, feature);
      })
      .catch(error => {
        onError?.(error);
      });
    return saveQueue;
  }

  async function saveProfile(profile) {
    const cleanProfile = normalizeProfile(profile);
    const clientId = "couple-profile";
    const encrypted = await encryptJson(dataKey, cleanProfile, itemContext("profile", clientId));
    const result = await supabase.from("vault_items").upsert({
      couple_id: coupleId,
      kind: "profile",
      client_id: clientId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      updated_by: userId
    }, { onConflict: "couple_id,kind,client_id" });
    throwIfError(result, "Não foi possível guardar o perfil do casal.");
    return cleanProfile;
  }

  async function loadProfile() {
    const result = await supabase
      .from("vault_items")
      .select("ciphertext,iv")
      .eq("couple_id", coupleId)
      .eq("kind", "profile")
      .eq("client_id", "couple-profile")
      .maybeSingle();
    const row = throwIfError(result, "Não foi possível abrir o perfil do casal.");
    if (!row) return null;
    return normalizeProfile(await decryptJson(dataKey, row, itemContext("profile", "couple-profile")));
  }

  function subscribe(onRemoteChange) {
    channel = supabase
      .channel(`private-vault-${coupleId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "vault_items",
        filter: `couple_id=eq.${coupleId}`
      }, payload => {
        if (payload.new?.updated_by === userId) return;
        void onRemoteChange();
      })
      .subscribe();
    return () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };
  }

  return { loadState, persist, saveProfile, loadProfile, subscribe };
}
