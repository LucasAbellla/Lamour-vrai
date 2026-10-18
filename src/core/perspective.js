// Quem está olhando o espaço. O perfil do casal é um só; a perspectiva inverte
// "eu" e "pessoa amada" conforme a identidade: owner = partnerOne, partner = partnerTwo.
export const ROLES = Object.freeze(["owner", "partner"]);

export function normalizeRole(role) {
  return ROLES.includes(role) ? role : "owner";
}

export function createViewer(profile, role) {
  const normalizedRole = normalizeRole(role);
  const isPartner = normalizedRole === "partner";
  const self = (isPartner ? profile.partnerTwo : profile.partnerOne) || "";
  const beloved = (isPartner ? profile.partnerOne : profile.partnerTwo) || "";
  return Object.freeze({
    role: normalizedRole,
    belovedRole: isPartner ? "owner" : "partner",
    isPartner,
    self,
    beloved,
    // Como quem está olhando chama a pessoa amada.
    nickname: (isPartner ? profile.partnerNickname : profile.nickname) || "",
    coupleName: `${self} & ${beloved}`
  });
}

export function nameForRole(profile, role) {
  return normalizeRole(role) === "partner" ? profile.partnerTwo : profile.partnerOne;
}

// Campos do perfil vistos da perspectiva de quem edita, e o caminho de volta.
export function profileToForm(profile, viewer) {
  return {
    selfName: viewer.isPartner ? profile.partnerTwo : profile.partnerOne,
    belovedName: viewer.isPartner ? profile.partnerOne : profile.partnerTwo,
    nickname: viewer.isPartner ? profile.partnerNickname : profile.nickname,
    relationshipStart: profile.relationshipStart,
    dedication: profile.dedication
  };
}

export function formToProfile(form, viewer) {
  return viewer.isPartner
    ? { partnerTwo: form.selfName, partnerOne: form.belovedName, partnerNickname: form.nickname, relationshipStart: form.relationshipStart, dedication: form.dedication }
    : { partnerOne: form.selfName, partnerTwo: form.belovedName, nickname: form.nickname, relationshipStart: form.relationshipStart, dedication: form.dedication };
}

export function relationshipDay(profile, today = new Date()) {
  const start = new Date(`${profile.relationshipStart}T00:00:00`);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const elapsed = Math.round((midnight - start) / 86400000);
  return Math.max(1, elapsed + 1);
}

export function anniversaryInfo(profile, today = new Date()) {
  const start = new Date(`${profile.relationshipStart}T00:00:00`);
  const years = today.getFullYear() - start.getFullYear();
  const isAnniversary = years > 0 && today.getMonth() === start.getMonth() && today.getDate() === start.getDate();
  const completedYears = years - (today < new Date(today.getFullYear(), start.getMonth(), start.getDate()) ? 1 : 0);
  return { isAnniversary, completedYears: Math.max(0, completedYears), volume: Math.max(0, completedYears) + 1 };
}

const ROMAN = [[100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function toRoman(value) {
  let rest = Math.max(1, Math.floor(value));
  let result = "";
  for (const [amount, symbol] of ROMAN) {
    while (rest >= amount) {
      result += symbol;
      rest -= amount;
    }
  }
  return result;
}
