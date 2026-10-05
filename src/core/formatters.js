export function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  })[character]);
}

export function safeImage(value = "") {
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) ? value : "";
}

export function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatCompactDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function calendarDifference(start, end) {
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

export async function fileToDataURL(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 1.5 * 1024 * 1024) throw new Error("A fotografia precisa ter até 1,5 MB nesta versão.");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
    reader.readAsDataURL(file);
  });
}
