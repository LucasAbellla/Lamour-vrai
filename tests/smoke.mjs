import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const executablePath = edgeCandidates.find(candidate => fs.existsSync(candidate));
if (!executablePath) throw new Error("Microsoft Edge não foi encontrado para o teste visual.");

const artifacts = path.resolve("tests", "artifacts");
fs.mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", error => runtimeErrors.push(error.message));
page.on("console", message => {
  if (message.type() === "error") runtimeErrors.push(message.text());
});

try {
  await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle" });
  await page.locator("#setup-panel").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(artifacts, "01-access.png"), fullPage: true });

  await page.locator('#setup-form [name="partnerOne"]').fill("Pessoa A");
  await page.locator('#setup-form [name="partnerTwo"]').fill("Pessoa B");
  await page.locator('#setup-form [name="nickname"]').fill("meu amor");
  await page.locator('#setup-form [name="relationshipStart"]').fill("2024-02-14");
  await page.locator('#setup-form [name="dedication"]').fill("Nossa história favorita ainda está sendo escrita.");
  await page.locator('#setup-form [name="passphrase"]').fill("teste-local");
  await page.getByRole("button", { name: "Criar nosso espaço", exact: true }).click();
  await page.locator("#access-gate").waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Guardar memória", exact: true }).first().click();
  await page.locator('#memory-form [name="title"]').fill("Nosso primeiro teste");
  await page.locator('#memory-form [name="date"]').fill("2026-10-05");
  await page.locator('#memory-form [name="category"]').selectOption("especial");
  await page.locator('#memory-form [name="description"]').fill("Uma lembrança criada para validar a nova estrutura.");
  await page.locator("#save-memory").click();
  await page.locator("#memory-count").waitFor();
  if ((await page.locator("#memory-count").innerText()) !== "01") throw new Error("A memória não foi contabilizada.");

  await page.locator("[data-open-dream]").first().click();
  await page.locator('#dream-form [name="title"]').fill("Ver o pôr do sol em outro lugar");
  await page.locator('#dream-form [name="description"]').fill("Uma experiência simples para guardar no nosso futuro.");
  await page.locator('#dream-form [name="status"]').selectOption("planejando");
  await page.getByRole("button", { name: "Guardar sonho", exact: true }).click();
  await page.getByText("Ver o pôr do sol em outro lugar", { exact: true }).waitFor();

  await page.getByRole("button", { name: "Abrir o envelope", exact: true }).click();
  await page.getByRole("button", { name: "Escrever ou editar a carta", exact: true }).click();
  await page.locator('#letter-form [name="body"]').fill("Uma carta de teste, guardada com cuidado dentro do novo cofre.");
  await page.getByRole("button", { name: "Guardar no cofre", exact: true }).click();
  await page.getByText("Uma carta de teste, guardada com cuidado dentro do novo cofre.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Fechar carta", exact: true }).click();

  await page.locator("[data-open-capsule]").first().click();
  await page.locator('#capsule-form [name="title"]').fill("Para um dia no futuro");
  await page.locator('#capsule-form [name="unlockDate"]').fill("2099-01-01");
  await page.locator('#capsule-form [name="message"]').fill("Mensagem protegida até a data escolhida.");
  await page.getByRole("button", { name: "Selar cápsula", exact: true }).click();
  await page.getByText("Para um dia no futuro", { exact: true }).waitFor();

  await page.screenshot({ path: path.join(artifacts, "02-private-space.png"), fullPage: true });

  await page.getByRole("button", { name: "Bloquear o espaço", exact: true }).click();
  await page.locator("#unlock-panel").waitFor({ state: "visible" });
  await page.locator('#unlock-form [name="passphrase"]').fill("teste-local");
  await page.getByRole("button", { name: "Entrar no L'amour vrai", exact: true }).click();
  await page.locator("#access-gate").waitFor({ state: "hidden" });
  await page.getByText("Pessoa A & Pessoa B", { exact: true }).first().waitFor();

  if (runtimeErrors.length) throw new Error(`Erros do navegador: ${runtimeErrors.join(" | ")}`);

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle" });
  await mobilePage.locator('#setup-form [name="partnerOne"]').fill("Pessoa A");
  await mobilePage.locator('#setup-form [name="partnerTwo"]').fill("Pessoa B");
  await mobilePage.locator('#setup-form [name="relationshipStart"]').fill("2024-02-14");
  await mobilePage.locator('#setup-form [name="passphrase"]').fill("teste-local");
  await mobilePage.getByRole("button", { name: "Criar nosso espaço", exact: true }).click();
  await mobilePage.locator("#access-gate").waitFor({ state: "hidden" });
  const hasHorizontalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (hasHorizontalOverflow) throw new Error("A versão móvel apresenta rolagem horizontal indevida.");
  await mobilePage.screenshot({ path: path.join(artifacts, "03-mobile.png"), fullPage: false });
  await mobileContext.close();

  process.stdout.write("Fluxo validado: acesso, memória, sonho, carta, cápsula, bloqueio, desbloqueio e layout móvel.\n");
} finally {
  await browser.close();
}
