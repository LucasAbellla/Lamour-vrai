import assert from "node:assert/strict";

const { createViewer, profileToForm, formToProfile, relationshipDay, anniversaryInfo, toRoman } = await import("../src/core/perspective.js");
const { normalizeProfile, fixShortYear } = await import("../src/data/defaults.js");
const { buildRetrospective } = await import("../src/features/story/retrospective.js");

const profile = normalizeProfile({
  partnerOne: "Pessoa A",
  partnerTwo: "Pessoa B",
  nickname: "apelido de A para B",
  partnerNickname: "apelido de B para A",
  relationshipStart: "2025-10-31",
  dedication: "Uma frase dos dois."
});

// ---------- Perspectiva ----------
const owner = createViewer(profile, "owner");
const partner = createViewer(profile, "partner");
assert.equal(owner.self, "Pessoa A");
assert.equal(owner.beloved, "Pessoa B");
assert.equal(owner.nickname, "apelido de A para B");
assert.equal(partner.self, "Pessoa B");
assert.equal(partner.beloved, "Pessoa A", "Na sessão da pessoa amada, quem preparou o espaço vira a pessoa amada.");
assert.equal(partner.nickname, "apelido de B para A");
assert.equal(partner.coupleName, "Pessoa B & Pessoa A");
assert.equal(partner.belovedRole, "owner");
assert.equal(createViewer(profile, "qualquer").role, "owner", "Papéis desconhecidos caem no padrão seguro.");

for (const viewer of [owner, partner]) {
  const form = profileToForm(profile, viewer);
  const roundTrip = normalizeProfile({ ...profile, ...formToProfile(form, viewer) });
  assert.deepEqual(roundTrip, profile, `Editar o perfil sem mudanças não pode trocar nomes (${viewer.role}).`);
}
const renamed = normalizeProfile({ ...profile, ...formToProfile({ ...profileToForm(profile, partner), selfName: "Pessoa B2", nickname: "novo apelido" }, partner) });
assert.equal(renamed.partnerTwo, "Pessoa B2");
assert.equal(renamed.partnerOne, "Pessoa A");
assert.equal(renamed.partnerNickname, "novo apelido");
assert.equal(renamed.nickname, "apelido de A para B", "O apelido da outra pessoa continua intacto.");

// ---------- Prelúdio ----------
const { preludeFor } = await import("../src/core/perspective.js");
const withPrelude = normalizeProfile({
  ...profile,
  preludes: { owner: { lines: ["  Primeira   frase ", "", "Segunda", "Terceira", "Quarta", "Quinta"], signature: "Assinatura de A" }, partner: { lines: [] } }
});
assert.deepEqual(withPrelude.preludes.owner.lines, ["Primeira frase", "Segunda", "Terceira", "Quarta"], "No máximo quatro frases, sem linhas vazias.");
assert.equal(normalizeProfile({ preludes: { owner: { lines: ["x".repeat(300)] } } }).preludes.owner.lines[0].length, 120);
assert.deepEqual(preludeFor(withPrelude, createViewer(withPrelude, "partner")), { name: "Pessoa B", lines: withPrelude.preludes.owner.lines, signature: "Assinatura de A" }, "A pessoa amada vê o prelúdio escrito por quem preparou o espaço.");
assert.equal(preludeFor(withPrelude, createViewer(withPrelude, "owner")), null, "Sem frases escritas pela outra pessoa, não há prelúdio.");
assert.deepEqual(preludeFor(profile, partner), { name: "Pessoa B", lines: [], signature: "" }, "Para a pessoa amada, o \"eu te amo\" formando o nome toca mesmo sem frases.");
const unsigned = normalizeProfile({ ...profile, preludes: { partner: { lines: ["Oi"] } } });
assert.equal(preludeFor(unsigned, createViewer(unsigned, "owner")).signature, "Pessoa B", "Sem assinatura, usa o nome de quem escreveu.");
assert.deepEqual(normalizeProfile({ ...withPrelude, ...formToProfile(profileToForm(withPrelude, owner), owner) }).preludes, withPrelude.preludes, "Editar o perfil não apaga o prelúdio.");

assert.equal(relationshipDay(profile, new Date(2025, 9, 31, 22)), 1);
assert.equal(relationshipDay(profile, new Date(2026, 9, 18, 8)), 353);
assert.deepEqual(anniversaryInfo(profile, new Date(2026, 9, 18)), { isAnniversary: false, completedYears: 0, volume: 1 });
assert.deepEqual(anniversaryInfo(profile, new Date(2026, 9, 31, 9)), { isAnniversary: true, completedYears: 1, volume: 2 });
assert.deepEqual(anniversaryInfo(profile, new Date(2026, 10, 1)), { isAnniversary: false, completedYears: 1, volume: 2 });
assert.equal(normalizeProfile({ relationshipStart: "0025-10-31" }).relationshipStart, "2025-10-31", "Ano digitado com dois dígitos volta a ser deste século.");
assert.equal(fixShortYear("2024-02-14"), "2024-02-14");
assert.equal(toRoman(4), "IV");
assert.equal(toRoman(14), "XIV");

// ---------- Retrospectiva ----------
const photo = "data:image/webp;base64,AAAA";
const state = {
  memories: [
    { id: "m3", title: "Reencontro", date: "2026-06-08", category: "encontro", description: "Aeroporto.", favorite: true, photo },
    { id: "m1", title: "O começo", date: "2025-10-31", category: "especial", description: "A primeira conversa.", favorite: true },
    { id: "m2", title: "Chamada", date: "2026-02-15", category: "distancia", description: "Duas cidades." },
    { id: "m4", title: "Outro reencontro", date: "2026-06-20", category: "encontro", description: "De novo." }
  ],
  dreams: [{ id: "d1", title: "Casa", realized: false }, { id: "d2", title: "Viagem", realized: true }],
  capsules: [{ id: "c1", title: "Futuro", unlockDate: "2027-10-31" }, { id: "c2", title: "Aberta", unlockDate: "2026-01-01" }],
  letters: []
};
const chapters = buildRetrospective({ state, profile, viewer: partner, hasLetterForViewer: true, today: new Date(2026, 9, 18) });
const keys = chapters.map(chapter => chapter.key);
assert.deepEqual(keys, ["prologue", "first", "numbers", "meetings", "month", "favorite", "future", "epilogue"]);
assert.equal(chapters[0].eyebrow, "Prólogo");
assert.match(chapters[0].emphasis, /31 de outubro de 2025/);
assert.match(chapters[0].text, /352 dias foram escritos/);
assert.equal(chapters[1].title, "O começo", "A primeira página é a memória mais antiga.");
assert.equal(chapters[1].eyebrow, "Capítulo I · A primeira página");
assert.deepEqual(chapters[2].stats.map(stat => stat.value), [4, 1, 2]);
assert.equal(chapters[3].title, "2 reencontros");
assert.match(chapters[3].text, /1 memória da distância/);
assert.equal(chapters[4].title, "Junho de 2026");
assert.equal(chapters[5].title, "Reencontro", "A favorita não repete a primeira página.");
assert.equal(chapters[5].photo, photo);
assert.equal(chapters[5].label, "Uma das favoritas");
assert.deepEqual(chapters[6].stats.map(stat => stat.label), ["sonho esperando", "já vivido", "cápsula selada"]);
assert.match(chapters[6].text, /31 de outubro de 2027/);
const epilogue = chapters.at(-1);
assert.equal(epilogue.quote, "Uma frase dos dois.");
assert.equal(epilogue.text, "Pessoa B ♥ Pessoa A", "O epílogo segue a perspectiva de quem lê.");
assert.equal(epilogue.action.label, "Abrir a carta de Pessoa A");
assert.equal(chapters.at(-2).eyebrow, "Capítulo VI · O que ainda vem");

const anniversary = buildRetrospective({ state, profile, viewer: owner, today: new Date(2026, 9, 31) });
assert.match(anniversary[0].text, /Hoje fazemos 1 ano/);
assert.equal(anniversary.at(-1).action, null);

const empty = buildRetrospective({ state: { memories: [], dreams: [], capsules: [], letters: [] }, profile: { ...profile, dedication: "" }, viewer: owner, today: new Date(2026, 9, 18) });
assert.deepEqual(empty.map(chapter => chapter.key), ["prologue", "blank", "epilogue"]);
assert.equal(empty.at(-1).quote, "E eu escolheria tudo outra vez.");

const single = buildRetrospective({ state: { ...state, memories: [state.memories[1]], dreams: [], capsules: [] }, profile, viewer: owner, today: new Date(2026, 9, 18) });
assert.deepEqual(single.map(chapter => chapter.key), ["prologue", "first", "epilogue"], "Capítulos sem dados suficientes são pulados.");

process.stdout.write("História validada: perspectiva dos dois, edição do perfil sem trocas, aniversário, capítulos montados com dados reais, capítulos vazios pulados e prelúdio de cada autor.\n");
