export const categoryNames = Object.freeze({
  cotidiano: "Cotidiano",
  encontro: "Encontro",
  distancia: "Distância",
  viagem: "Viagem",
  especial: "Data especial"
});

export const starPositions = Object.freeze([
  [14,24],[31,14],[52,27],[72,13],[86,34],[68,48],[44,43],[23,52],
  [12,73],[35,76],[58,67],[82,76],[69,88],[43,91],[91,56]
]);

export function createEmptyState() {
  return {
    schemaVersion: 2,
    memories: [],
    dreams: [],
    capsules: [],
    letters: []
  };
}

export function normalizeProfile(input = {}) {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(input.relationshipStart || "")
    ? input.relationshipStart
    : new Date().toISOString().slice(0, 10);

  return {
    partnerOne: String(input.partnerOne || "").trim().slice(0, 40),
    partnerTwo: String(input.partnerTwo || "").trim().slice(0, 40),
    nickname: String(input.nickname || "").trim().slice(0, 60),
    dedication: String(input.dedication || "").trim().slice(0, 180),
    relationshipStart: start,
    anniversaryNumber: Math.max(1, Number(input.anniversaryNumber) || 1)
  };
}
