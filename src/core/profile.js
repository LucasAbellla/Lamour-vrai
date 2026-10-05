import { calendarDifference, formatCompactDate } from "./formatters.js";

export function applyProfile(profile) {
  const coupleName = `${profile.partnerOne} & ${profile.partnerTwo}`;
  const relationshipStart = new Date(`${profile.relationshipStart}T00:00:00`);
  const elapsedDays = Math.max(0, Math.floor((Date.now() - relationshipStart.getTime()) / 86400000));
  document.title = `L'amour vrai · ${coupleName}`;
  document.querySelectorAll("[data-profile='couple-name']").forEach(element => { element.textContent = coupleName; });
  document.querySelectorAll("[data-profile='partner-one']").forEach(element => { element.textContent = profile.partnerOne; });
  document.querySelectorAll("[data-profile='partner-two']").forEach(element => { element.textContent = profile.partnerTwo; });
  document.querySelectorAll("[data-profile='start-date']").forEach(element => { element.textContent = formatCompactDate(profile.relationshipStart).replaceAll("/", " · "); });
  document.querySelectorAll("[data-profile='start-year']").forEach(element => { element.textContent = profile.relationshipStart.slice(0, 4); });
  document.querySelectorAll("[data-profile='day-count']").forEach(element => { element.textContent = String(elapsedDays); });
  document.querySelectorAll("[data-profile='dedication']").forEach(element => {
    element.textContent = profile.dedication || "E eu escolheria tudo outra vez.";
  });
  document.querySelectorAll("[data-profile='nickname']").forEach(element => {
    element.textContent = profile.nickname || "meu amor";
  });
}

export function startRelationshipClock(profile) {
  const updateTimer = () => {
    const values = calendarDifference(new Date(`${profile.relationshipStart}T00:00:00`), new Date());
    if (!values) return;
    Object.entries(values).forEach(([unit, value]) => {
      const target = document.querySelector(`[data-unit="${unit}"]`);
      const next = String(value).padStart(2, "0");
      if (target && target.textContent !== next) {
        target.style.opacity = ".4";
        setTimeout(() => {
          target.textContent = next;
          target.style.opacity = "1";
        }, 100);
      }
    });
  };

  const updateAnniversary = () => {
    const start = new Date(`${profile.relationshipStart}T00:00:00`);
    const today = new Date();
    let next = new Date(today.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate(), 0, 0, 0);
    const days = Math.ceil((next - today) / 86400000);
    document.querySelector("#anniversary-days").textContent = days === 0 ? "hoje" : String(days).padStart(2, "0");
    document.querySelector("#anniversary-label").textContent = days === 0 ? "é o nosso aniversário" : "dias para nosso aniversário";
  };

  updateTimer();
  updateAnniversary();
  const interval = setInterval(updateTimer, 1000);
  return () => clearInterval(interval);
}
