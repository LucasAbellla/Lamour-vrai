// Fotografias são reduzidas no próprio aparelho antes de serem guardadas.
// Redesenhar no canvas também descarta metadados EXIF, inclusive localização.
export const PHOTO_MAX_DIMENSION = 1600;
export const PHOTO_TARGET_BYTES = 700 * 1024;
export const PHOTO_INPUT_LIMIT_BYTES = 40 * 1024 * 1024;

const QUALITY_STEPS = [.84, .76, .68, .6];
const MIN_DIMENSION = 640;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir essa fotografia. Se ela estiver em HEIC, exporte como JPEG e tente de novo."));
    image.src = source;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível preparar a fotografia."));
    reader.readAsDataURL(blob);
  });
}

async function encode(canvas, quality) {
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  // Safari ainda pode devolver PNG quando não codifica WebP; nesse caso usamos JPEG.
  if (webp?.type === "image/webp") return webp;
  return canvasToBlob(canvas, "image/jpeg", quality);
}

async function compressImage(image) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error("Essa fotografia parece estar vazia.");

  let dimension = Math.min(PHOTO_MAX_DIMENSION, Math.max(width, height));
  let smallest = null;
  while (true) {
    const scale = dimension / Math.max(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITY_STEPS) {
      const blob = await encode(canvas, quality);
      if (!blob) continue;
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= PHOTO_TARGET_BYTES) return blob;
    }
    canvas.width = canvas.height = 0;
    if (dimension <= MIN_DIMENSION) break;
    dimension = Math.max(MIN_DIMENSION, Math.round(dimension * .8));
  }
  if (!smallest) throw new Error("Este navegador não conseguiu preparar a fotografia.");
  return smallest;
}

async function prepareFromSource(source) {
  const image = await loadImage(source);
  const blob = await compressImage(image);
  return { dataUrl: await blobToDataURL(blob), bytes: blob.size, type: blob.type };
}

export async function preparePhotoFile(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > PHOTO_INPUT_LIMIT_BYTES) throw new Error("Essa fotografia é grande demais para ser preparada neste aparelho.");
  const url = URL.createObjectURL(file);
  try {
    return await prepareFromSource(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Usado na migração: fotos antigas (até 1,5 MB, com metadados) passam pelo mesmo ajuste.
export async function preparePhotoDataUrl(dataUrl) {
  if (!dataUrl) return "";
  const approximateBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * .75);
  if (approximateBytes <= PHOTO_TARGET_BYTES && /^data:image\/webp;/i.test(dataUrl)) return dataUrl;
  return (await prepareFromSource(dataUrl)).dataUrl;
}
