import { formatDate, safeImage } from "../../core/formatters.js";
import { anniversaryInfo, relationshipDay, toRoman } from "../../core/perspective.js";

// Monta "Revisitar nossa história" a partir do que está guardado. Nenhum texto pessoal vive no código:
// os fatos vêm das memórias, sonhos e cápsulas; a frase final é a dedicatória do perfil.
const DEFAULT_DEDICATION = "E eu escolheria tudo outra vez.";

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function byDate(a, b) {
  return a.date.localeCompare(b.date) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 15));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function memoryChapter(memory, name) {
  return {
    key: name,
    title: memory.title,
    text: `${formatDate(memory.date)}. ${memory.description}`,
    photo: safeImage(memory.photo)
  };
}

export function buildRetrospective({ state, profile, viewer, hasLetterForViewer = false, today = new Date() }) {
  const memories = [...state.memories].filter(memory => memory.date).sort(byDate);
  const day = relationshipDay(profile, today);
  const elapsed = day - 1;
  const { isAnniversary, completedYears } = anniversaryInfo(profile, today);
  const chapters = [];

  const prologueText = elapsed === 0
    ? "E hoje é o primeiro dia."
    : isAnniversary
      ? `Hoje fazemos ${plural(completedYears, "ano", "anos")}. Foram ${elapsed} dias escritos a quatro mãos.`
      : `Desde então, ${elapsed} ${elapsed === 1 ? "dia foi escrito" : "dias foram escritos"} a quatro mãos.`;
  chapters.push({ key: "prologue", eyebrow: "Prólogo", title: "Tudo começou em", emphasis: `${formatDate(profile.relationshipStart)}.`, text: prologueText });

  if (!memories.length) {
    chapters.push({ key: "blank", label: "As próximas páginas", title: "As próximas páginas", emphasis: "ainda estão em branco.", text: "Guarde a primeira memória e ela abre o próximo capítulo." });
  } else {
    const first = memories[0];
    chapters.push({ ...memoryChapter(first, "first"), label: "A primeira página" });

    if (memories.length >= 2) {
      const photos = memories.filter(memory => safeImage(memory.photo)).length;
      const favorites = memories.filter(memory => memory.favorite).length;
      const stats = [{ value: memories.length, label: memories.length === 1 ? "memória" : "memórias" }];
      if (photos) stats.push({ value: photos, label: photos === 1 ? "fotografia" : "fotografias" });
      if (favorites) stats.push({ value: favorites, label: favorites === 1 ? "favorita" : "favoritas" });
      chapters.push({ key: "numbers", label: "O que guardamos", title: "Cada lembrança acendeu", emphasis: "uma estrela.", stats, text: "Do primeiro dia até hoje, o nosso céu não parou de crescer." });
    }

    const meetings = memories.filter(memory => memory.category === "encontro").length;
    const distance = memories.filter(memory => memory.category === "distancia").length;
    if (meetings) {
      chapters.push({
        key: "meetings",
        label: "Entre partidas e chegadas",
        title: plural(meetings, "reencontro", "reencontros"),
        emphasis: meetings === 1 ? "guardado." : "guardados.",
        text: distance
          ? `E ${plural(distance, "memória", "memórias")} da distância — porque a saudade também faz parte da história.`
          : "Cada um deles valeu a espera."
      });
    } else if (distance) {
      chapters.push({ key: "meetings", label: "Entre partidas e chegadas", title: plural(distance, "memória", "memórias"), emphasis: "da distância.", text: "Guardadas até o próximo abraço." });
    }

    const months = new Map();
    for (const memory of memories) months.set(memory.date.slice(0, 7), (months.get(memory.date.slice(0, 7)) || 0) + 1);
    const [busiestMonth, busiestCount] = [...months.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (busiestCount >= 2 && months.size >= 2) {
      chapters.push({ key: "month", label: "O mês mais cheio", title: monthLabel(busiestMonth), emphasis: "foi o nosso mês mais cheio.", text: `${busiestCount} memórias guardadas em um só mês.` });
    }

    const favorites = memories.filter(memory => memory.favorite);
    const favorite = [...favorites].reverse().find(memory => memory.id !== first.id);
    if (favorite) chapters.push({ ...memoryChapter(favorite, "favorite"), label: favorites.length > 1 ? "Uma das favoritas" : "A favorita" });
  }

  const waitingDreams = state.dreams.filter(dream => !dream.realized).length;
  const livedDreams = state.dreams.filter(dream => dream.realized).length;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const sealed = state.capsules.filter(capsule => capsule.unlockDate > todayKey).sort((a, b) => a.unlockDate.localeCompare(b.unlockDate));
  if (waitingDreams || livedDreams || sealed.length) {
    const stats = [];
    if (waitingDreams) stats.push({ value: waitingDreams, label: waitingDreams === 1 ? "sonho esperando" : "sonhos esperando" });
    if (livedDreams) stats.push({ value: livedDreams, label: livedDreams === 1 ? "já vivido" : "já vividos" });
    if (sealed.length) stats.push({ value: sealed.length, label: sealed.length === 1 ? "cápsula selada" : "cápsulas seladas" });
    chapters.push({
      key: "future",
      label: "O que ainda vem",
      title: "O futuro já tem",
      emphasis: "lugar marcado.",
      stats,
      text: sealed.length ? `A próxima cápsula abre em ${formatDate(sealed[0].unlockDate)}.` : "Ainda estamos só começando."
    });
  }

  chapters.push({
    key: "epilogue",
    eyebrow: "Epílogo",
    quote: profile.dedication || DEFAULT_DEDICATION,
    text: `${viewer.self} ♥ ${viewer.beloved}`,
    action: hasLetterForViewer ? { type: "letter", label: `Abrir a carta de ${viewer.beloved}` } : null
  });

  let number = 0;
  return chapters.map(chapter => {
    if (chapter.eyebrow) return chapter;
    number += 1;
    return { ...chapter, eyebrow: `Capítulo ${toRoman(number)} · ${chapter.label}` };
  });
}
