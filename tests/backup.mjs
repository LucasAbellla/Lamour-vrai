import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

globalThis.crypto ||= webcrypto;
globalThis.btoa ||= value => Buffer.from(value, "binary").toString("base64");
globalThis.atob ||= value => Buffer.from(value, "base64").toString("binary");

function installLocalStorage() {
  const data = new Map();
  const fake = {
    quota: Infinity,
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem(key, value) {
      if (String(value).length > fake.quota) {
        const error = new Error("quota");
        error.name = "QuotaExceededError";
        throw error;
      }
      data.set(key, String(value));
    },
    removeItem: key => data.delete(key)
  };
  Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true, writable: true });
  return fake;
}

const storage = installLocalStorage();
const { parseBackup, mergeBackup, describeCounts, importBackupIntoStore } = await import("../src/core/backup.js");
const { createStore } = await import("../src/core/store.js");
const { createVaultEnvelope } = await import("../src/security/crypto-vault.js");
const { createSecureVaultRepository } = await import("../src/security/secure-vault.repository.js");

// Supabase falso, em memória, com o mesmo formato de chamadas usado pelo repositório.
function createFakeSupabase() {
  const tables = { vault_items: [] };
  const files = new Map();
  const log = { upserts: 0, deletes: 0, uploads: 0 };
  const control = { failUploads: 0 };
  const query = table => {
    const filters = [];
    let operation = "select";
    let payload = null;
    const execute = () => {
      const rows = tables[table] ||= [];
      if (operation === "upsert") {
        log.upserts += 1;
        const index = rows.findIndex(row => row.couple_id === payload.couple_id && row.kind === payload.kind && row.client_id === payload.client_id);
        if (index >= 0) rows[index] = { ...payload };
        else rows.push({ ...payload });
        return { data: null, error: null };
      }
      const matched = rows.filter(row => filters.every(filter => filter(row)));
      if (operation === "delete") {
        log.deletes += matched.length;
        tables[table] = rows.filter(row => !matched.includes(row));
        return { data: null, error: null };
      }
      return { data: matched.map(row => ({ ...row })), error: null };
    };
    const builder = {
      select: () => builder,
      eq: (column, value) => { filters.push(row => row[column] === value); return builder; },
      in: (column, values) => { filters.push(row => values.includes(row[column])); return builder; },
      upsert: row => { operation = "upsert"; payload = row; return builder; },
      delete: () => { operation = "delete"; return builder; },
      then: (resolve, reject) => Promise.resolve().then(execute).then(resolve, reject)
    };
    return builder;
  };
  return {
    from: query,
    storage: {
      from: () => ({
        async upload(path, bytes) {
          if (control.failUploads > 0) {
            control.failUploads -= 1;
            return { data: null, error: { message: "rede indisponível" } };
          }
          log.uploads += 1;
          files.set(path, new Uint8Array(bytes));
          return { data: { path }, error: null };
        },
        async download(path) {
          return files.has(path) ? { data: new Blob([files.get(path)]), error: null } : { data: null, error: { message: "não encontrado" } };
        },
        async remove(paths) {
          paths.forEach(path => files.delete(path));
          return { data: null, error: null };
        }
      })
    },
    tables,
    files,
    log,
    control
  };
}

const photoBytes = Buffer.from("fotografia-de-teste-".repeat(40));
const photo = `data:image/png;base64,${photoBytes.toString("base64")}`;

// ---------- Leitura e limpeza do arquivo ----------
const backupFile = JSON.stringify({
  schemaVersion: 2,
  profile: { partnerOne: "Pessoa A", partnerTwo: "Pessoa B", relationshipStart: "2024-02-14" },
  memories: [
    { id: "memory-existente", title: "Título que não pode substituir o do cofre", date: "2026-01-01", category: "especial", description: "Repetida." },
    { id: "memory-nova", title: "  Nova memória  ", date: "2026-03-10", category: "inexistente", description: "Chegou pelo backup.", photo, favorite: "sim" },
    { id: "demo-start", title: "Exemplo", date: "2025-10-31", description: "Demonstração antiga.", demo: true },
    { id: "memory-sem-data", title: "Sem data", date: "ontem", description: "Inválida." },
    { id: "memory-foto-falsa", title: "Foto estranha", date: "2026-04-01", description: "Imagem inválida.", photo: "javascript:alert(1)" }
  ],
  dreams: [{ id: "home", title: "Nossa casa", description: "Um lugar só nosso.", status: "planejando" }],
  capsules: [{ id: "capsule-1", title: "Sem data de abertura", message: "Inválida." }],
  letters: [{ id: "letter-1", body: "Uma carta guardada antes do cofre." }]
});

const parsed = parseBackup(backupFile);
assert.equal(parsed.state.memories.length, 3, "Demonstrações e memórias sem data devem ser ignoradas.");
assert.equal(parsed.discarded, 3);
const freshMemory = parsed.state.memories.find(memory => memory.id === "memory-nova");
assert.equal(freshMemory.title, "Nova memória");
assert.equal(freshMemory.category, "cotidiano", "Categorias desconhecidas viram cotidiano.");
assert.equal(freshMemory.favorite, false, "Somente true marca favorita.");
assert.equal(parsed.state.memories.find(memory => memory.id === "memory-foto-falsa").photo, "", "Fotos fora do formato permitido são descartadas.");
assert.equal(parsed.profile.partnerOne, "Pessoa A");
assert.throws(() => parseBackup("não é json"), /não parece ser um backup/);
assert.throws(() => parseBackup({ qualquer: true }), /não parece ser um backup/);
assert.equal(describeCounts({ memories: 2, dreams: 1, capsules: 0, letters: 1 }), "2 memórias, 1 sonho e 1 carta");

const authored = parseBackup({
  memories: [
    { id: "m-b", title: "Guardada por B", date: "2026-01-02", description: "Autoria.", createdBy: "partner" },
    { id: "m-x", title: "Autoria estranha", date: "2026-01-03", description: "Autoria.", createdBy: "admin" }
  ],
  letters: [{ id: "carta-b", body: "Carta de B.", author: "partner" }, { id: "carta-antiga", body: "Carta sem autoria." }]
});
assert.equal(authored.state.memories[0].createdBy, "partner", "A autoria da memória sobrevive à migração.");
assert.equal("createdBy" in authored.state.memories[1], false, "Autorias desconhecidas são descartadas.");
assert.equal(authored.state.letters[0].author, "partner", "A carta da pessoa amada continua sendo dela.");
assert.equal(authored.state.letters[1].author, "owner", "Cartas antigas pertencem a quem preparou o espaço.");

const mergedPreview = mergeBackup({ memories: [{ id: "memory-existente", title: "Original" }], dreams: [], capsules: [], letters: [] }, parsed.state);
assert.equal(mergedPreview.skipped, 1);
assert.equal(mergedPreview.state.memories.find(memory => memory.id === "memory-existente").title, "Original");
assert.notEqual(mergedPreview.added.memories[0], parsed.state.memories[1], "A mesclagem não altera o backup original.");

// ---------- Migração completa para o cofre cifrado ----------
const supabase = createFakeSupabase();
const { dataKey } = await createVaultEnvelope("uma frase longa e somente nossa");
const vaultErrors = [];
const repository = createSecureVaultRepository({ supabase, coupleId: "casal-1", userId: "pessoa-a", dataKey, onError: error => vaultErrors.push(error) });

await repository.persist({
  memories: [{ id: "memory-existente", title: "Memória que já estava no cofre", date: "2025-12-24", category: "encontro", description: "Original." }],
  dreams: [{ id: "dream-sofia", title: "Sonho escrito no outro aparelho", description: "Precisa continuar existindo.", status: "sonhando", realized: false }],
  capsules: [],
  letters: []
});
const rowsBefore = supabase.tables.vault_items.length;
const store = createStore("teste", {
  initialState: await repository.loadState(),
  localPersistence: false,
  persist: (state, meta) => repository.persist(state, meta)
});

const progress = [];
const result = await importBackupIntoStore({
  store,
  backup: parsed,
  preparePhoto: async value => value,
  onProgress: step => progress.push(step.stage)
});
assert.deepEqual(result.added, { memories: 2, dreams: 1, capsules: 0, letters: 1 });
assert.equal(result.skipped, 1);
assert.deepEqual(progress, ["photos", "saving"]);
assert.equal(supabase.log.deletes, 0, "A migração nunca pode apagar registros do cofre.");
assert.equal(supabase.tables.vault_items.length, rowsBefore + 4);
assert.equal(vaultErrors.length, 0);

for (const row of supabase.tables.vault_items) {
  for (const plain of ["Nova memória", "Uma carta guardada", "Nossa casa", "fotografia-de-teste"]) {
    assert.equal(row.ciphertext.includes(plain), false, `Texto aberto encontrado no cofre: ${plain}`);
  }
}
const storedPhoto = supabase.files.get("casal-1/memory-nova.bin");
assert.ok(storedPhoto, "A fotografia precisa ir para o bucket privado.");
assert.equal(Buffer.from(storedPhoto).includes(photoBytes.subarray(0, 40)), false, "A fotografia precisa estar cifrada.");

const reopened = createSecureVaultRepository({ supabase, coupleId: "casal-1", userId: "pessoa-b", dataKey });
const vaultState = await reopened.loadState();
assert.equal(vaultState.memories.find(memory => memory.id === "memory-existente").title, "Memória que já estava no cofre");
assert.equal(vaultState.memories.find(memory => memory.id === "memory-nova").photo, photo, "A fotografia precisa abrir igual no outro aparelho.");
assert.ok(vaultState.dreams.some(dream => dream.id === "dream-sofia"), "O que o outro aparelho guardou continua no cofre.");

const upsertsBeforeRepeat = supabase.log.upserts;
const repeated = await importBackupIntoStore({ store, backup: parseBackup(backupFile) });
assert.equal(repeated.totalAdded, 0, "Importar o mesmo arquivo de novo não duplica nada.");
assert.equal(supabase.log.upserts, upsertsBeforeRepeat);

// ---------- Falha de rede e nova tentativa ----------
supabase.control.failUploads = 1;
const secondBackup = parseBackup({ memories: [{ id: "memory-offline", title: "Enviada depois", date: "2026-05-05", description: "Com foto.", photo }] });
await assert.rejects(() => importBackupIntoStore({ store, backup: secondBackup }), /rede indisponível/);
assert.equal(supabase.files.has("casal-1/memory-offline.bin"), false);
store.replace(store.getState(), { feature: "backup" });
await store.whenSaved();
assert.ok(supabase.files.has("casal-1/memory-offline.bin"), "A nova tentativa precisa enviar o que faltou.");
assert.ok((await reopened.loadState()).memories.some(memory => memory.id === "memory-offline"));
assert.equal(supabase.log.deletes, 0);

// ---------- Espaço do navegador esgotado no modo local ----------
const localStore = createStore("local");
localStore.update(state => state.memories.push({ id: "memory-1", title: "Cabe", date: "2026-01-01", category: "cotidiano", description: "Ok." }));
storage.quota = JSON.stringify(localStore.getState()).length + 10;
assert.throws(
  () => localStore.update(state => state.memories.push({ id: "memory-2", title: "Não cabe", date: "2026-01-02", category: "cotidiano", description: "x".repeat(200), photo })),
  /espaço deste navegador acabou/
);
assert.equal(localStore.getState().memories.length, 1, "Sem espaço, o estado volta ao último salvo.");
assert.equal(JSON.parse(storage.getItem("local-data-v2")).memories.length, 1);

// ---------- Fotos das páginas e músicas da rádio ----------
const songBytes = new Uint8Array(Buffer.from("trecho-de-musica-".repeat(64)));
const songAsset = await repository.media.save("song-1", new Blob([songBytes], { type: "audio/mpeg" }));
assert.deepEqual(Object.keys(songAsset).sort(), ["iv", "mime", "path"]);
assert.equal(songAsset.path, "casal-1/song-1.bin");
assert.equal(Buffer.from(supabase.files.get("casal-1/song-1.bin")).includes(Buffer.from("trecho-de-musica-")), false, "A música precisa estar cifrada no armazenamento.");
const reopenedSong = await reopened.media.load("song-1", songAsset);
assert.equal(reopenedSong.type, "audio/mpeg");
assert.deepEqual(new Uint8Array(await reopenedSong.arrayBuffer()), songBytes, "A música abre igual no outro aparelho.");
await assert.rejects(reopened.media.load("song-2", songAsset), /não pertence/, "Um arquivo não abre com o nome de outro.");
supabase.files.set("casal-1/song-2.bin", supabase.files.get("casal-1/song-1.bin"));
await assert.rejects(reopened.media.load("song-2", { ...songAsset, path: "casal-1/song-2.bin" }), "Copiar o arquivo para outro nome não engana a cifra.");
await reopened.media.remove("song-1");
assert.equal(supabase.files.has("casal-1/song-1.bin"), false);

process.stdout.write("Backup validado: limpeza do arquivo, mesclagem sem perdas, cofre cifrado, fotos protegidas, reimportação sem duplicar, nova tentativa, limite do navegador e músicas cifradas.\n");
