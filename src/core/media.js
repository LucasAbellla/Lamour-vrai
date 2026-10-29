// Arquivos grandes (fotos das páginas, músicas da rádio) ficam fora do perfil. No modo seguro eles são
// cifrados e vão para o armazenamento do cofre; no modo local ficam no IndexedDB deste aparelho.

export function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) throw new Error("Não foi possível preparar este arquivo.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

export function createLocalMedia(namespace) {
  let database = null;

  function open() {
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(`${namespace}-media`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Este navegador não permite guardar arquivos."));
    });
    return database;
  }

  async function run(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("files", mode);
      const request = action(transaction.objectStore("files"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar o arquivo neste aparelho."));
    });
  }

  return {
    async save(id, blob) {
      await run("readwrite", store => store.put(blob, id));
      return { local: true, mime: blob.type };
    },
    async load(id) {
      const blob = await run("readonly", store => store.get(id));
      if (!blob) throw new Error("Este arquivo não está guardado neste aparelho.");
      return blob;
    },
    async remove(id) {
      await run("readwrite", store => store.delete(id));
    }
  };
}

// Guarda as URLs já abertas nesta visita, para cada arquivo ser baixado e decifrado uma vez só.
export function createMediaLibrary(getMedia) {
  const urls = new Map();
  return {
    url(id, asset) {
      if (!urls.has(id)) {
        const media = getMedia();
        const pending = media
          ? media.load(id, asset).then(blob => URL.createObjectURL(blob))
          : Promise.reject(new Error("Abra o cofre para ver este arquivo."));
        pending.catch(() => urls.delete(id));
        urls.set(id, pending);
      }
      return urls.get(id);
    },
    forget(id) {
      const pending = urls.get(id);
      urls.delete(id);
      pending?.then(url => URL.revokeObjectURL(url), () => {});
    }
  };
}
