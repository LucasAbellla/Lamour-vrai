import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

// Uma foto de celular típica: 12 MP, gradiente com ruído e bem maior que o antigo limite de 1,5 MB.
async function createLargePhoto() {
  const width = 4000;
  const height = 3000;
  const raw = Buffer.alloc(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    const noise = Math.floor(Math.random() * 36);
    raw[index * 3] = (x * 200 / width + noise) & 255;
    raw[index * 3 + 1] = (y * 120 / height + noise) & 255;
    raw[index * 3 + 2] = ((x + y) * 90 / width + noise) & 255;
  }
  const photo = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  if (photo.length <= 1.5 * 1024 * 1024) throw new Error("A foto de teste precisa ser maior que 1,5 MB.");
  return photo;
}

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
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    if (!href) throw new Error("O manifest não foi ligado ao documento.");
    const response = await fetch(href);
    return response.json();
  });
  if (manifest.display !== "standalone" || !manifest.icons?.some(icon => icon.sizes === "512x512")) {
    throw new Error("O manifest PWA não contém os requisitos de instalação.");
  }
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service Worker indisponível.");
    await navigator.serviceWorker.ready;
  });
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
  await page.locator("#book-opening.visible").waitFor();
  const coverText = await page.locator(".book-cover").innerText();
  // Início em 14/02/2024: dois anos completos, terceiro volume.
  if (!/Volume III\b/i.test(coverText) || !/Capítulo \d+/.test(coverText) || !coverText.includes("Pessoa A & Pessoa B")) throw new Error(`Capa do livro incompleta: ${coverText}`);
  await page.screenshot({ path: path.join(artifacts, "01b-book-cover.png"), fullPage: false });
  await page.getByRole("button", { name: "Entrar como Pessoa A", exact: true }).click();
  await page.locator("#book-opening").waitFor({ state: "hidden" });

  const headerButtons = page.locator(".topbar button");
  if (await headerButtons.count() !== 1) throw new Error("O cabeçalho deve manter somente o botão de guardar memória.");
  await page.locator(".topbar").getByRole("button", { name: /Guardar memória/ }).waitFor();
  if (await page.locator(".little-things, #notes-grid").count()) throw new Error("A seção Pequenas coisas tuas ainda está presente.");
  const contentOrderIsCorrect = await page.evaluate(() => {
    const dreams = document.querySelector("#futuro");
    const capsules = document.querySelector("#capsulas");
    return Boolean(dreams && capsules && (dreams.compareDocumentPosition(capsules) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  if (!contentOrderIsCorrect) throw new Error("Os sonhos precisam aparecer antes das cápsulas.");

  await page.getByRole("button", { name: "Guardar memória", exact: true }).first().click();
  await page.locator('#memory-form [name="title"]').fill("Nosso primeiro teste");
  await page.locator('#memory-form [name="date"]').fill("2026-10-05");
  await page.locator('#memory-form [name="category"]').selectOption("especial");
  await page.locator('#memory-form [name="description"]').fill("Uma lembrança criada para validar a nova estrutura.");
  await page.locator('#memory-form [name="photo"]').setInputFiles({ name: "foto-do-celular.jpg", mimeType: "image/jpeg", buffer: await createLargePhoto() });
  await page.locator("#save-memory").click();
  await page.locator("#memory-dialog").waitFor({ state: "hidden", timeout: 30000 });
  if ((await page.locator("#memory-count").innerText()) !== "01") throw new Error("A memória não foi contabilizada.");
  const savedPhoto = await page.evaluate(async () => {
    const photo = JSON.parse(localStorage.getItem("lamour-vrai-data-v2")).memories[0].photo;
    const image = new Image();
    image.src = photo;
    await image.decode();
    return { type: photo.slice(5, photo.indexOf(";")), bytes: Math.round((photo.length - photo.indexOf(",") - 1) * .75), width: image.naturalWidth, height: image.naturalHeight };
  });
  if (savedPhoto.type !== "image/webp" || savedPhoto.bytes > 700 * 1024 || Math.max(savedPhoto.width, savedPhoto.height) > 1600) {
    throw new Error(`A fotografia não foi reduzida corretamente: ${JSON.stringify(savedPhoto)}`);
  }

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

  await page.keyboard.press("Control+K");
  await page.getByRole("button", { name: /Bloquear nosso espaço/ }).click();
  await page.locator("#unlock-panel").waitFor({ state: "visible" });
  await page.locator('#unlock-form [name="passphrase"]').fill("teste-local");
  await page.getByRole("button", { name: "Entrar no L'amour vrai", exact: true }).click();
  await page.locator("#access-gate").waitFor({ state: "hidden" });

  // Perspectiva da pessoa amada: mesma base, olhar invertido, nenhuma carta sobrescrita.
  await page.getByRole("button", { name: "Entrar como Pessoa B", exact: true }).click();
  await page.locator("#book-opening").waitFor({ state: "hidden" });
  await page.getByText("Pessoa B & Pessoa A", { exact: true }).first().waitFor();
  if ((await page.locator("#letter-eyebrow").innerText()).toUpperCase() !== "UMA CARTA DE PESSOA A") throw new Error("A carta recebida não aparece na perspectiva da pessoa amada.");
  await page.getByRole("button", { name: "Abrir o envelope", exact: true }).click();
  await page.getByText("Uma carta de teste, guardada com cuidado dentro do novo cofre.", { exact: true }).waitFor();
  if (await page.locator("[data-edit-letter]").isVisible()) throw new Error("A pessoa amada não pode editar a carta que recebeu.");
  await page.locator("[data-switch-letter]").click();
  await page.getByRole("button", { name: "Escrever ou editar a carta", exact: true }).click();
  await page.locator('#letter-form [name="body"]').fill("A resposta, escrita do outro lado.");
  await page.getByRole("button", { name: "Guardar no cofre", exact: true }).click();
  await page.getByText("A resposta, escrita do outro lado.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Fechar carta", exact: true }).click();
  const letterAuthors = await page.evaluate(() => JSON.parse(localStorage.getItem("lamour-vrai-data-v2")).letters.map(letter => letter.author).sort().join(","));
  if (letterAuthors !== "owner,partner") throw new Error(`As duas cartas precisam coexistir: ${letterAuthors}`);

  await page.locator("[data-open-story]").first().click();
  await page.locator("#story-dialog[open]").waitFor();
  const storyTitles = [];
  for (let step = 0; step < 12; step += 1) {
    await page.waitForTimeout(600);
    storyTitles.push(await page.locator("#story-eyebrow").innerText());
    const next = page.locator("#story-next");
    if ((await next.innerText()).startsWith("Voltar")) break;
    await next.click();
  }
  const epilogue = await page.locator("#story-subtext").innerText();
  if (!storyTitles.some(title => /A primeira página/i.test(title)) || epilogue !== "Pessoa B ♥ Pessoa A") throw new Error(`Retrospectiva incompleta: ${storyTitles.join(" | ")} / ${epilogue}`);
  await page.getByRole("button", { name: "Abrir a carta de Pessoa A", exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, "05-retrospective.png"), fullPage: false });
  await page.getByRole("button", { name: "Fechar experiência", exact: true }).click();

  const nativeInstallAvailable = await page.locator("html").evaluate(element => element.classList.contains("can-install"));
  if (!nativeInstallAvailable) {
    await page.locator("#install-app-footer").click();
    await page.locator("#install-dialog").waitFor({ state: "visible" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifacts, "04-install-guide.png"), fullPage: false });
    await page.getByRole("button", { name: "Entendi", exact: true }).click();
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#app-shell").waitFor({ state: "visible" });
  await page.locator("html.is-offline").waitFor();
  await context.setOffline(false);

  const backupFile = {
    schemaVersion: 2,
    memories: [
      { id: "memory-backup", title: "Memória do backup", date: "2026-02-01", category: "encontro", description: "Restaurada pelo teste." },
      { id: "demo-start", demo: true, title: "Exemplo", date: "2025-10-31", description: "Demonstração antiga." }
    ],
    dreams: []
  };
  await page.locator("#import-data").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backupFile)) });
  await page.locator("#import-dialog").waitFor({ state: "visible" });
  const importSummary = await page.locator("#import-summary").innerText();
  if (!importSummary.includes("1 memória")) throw new Error(`Resumo do backup inesperado: ${importSummary}`);
  await page.getByRole("button", { name: "Restaurar backup", exact: true }).click();
  await page.locator("#import-dialog").waitFor({ state: "hidden" });
  await page.getByText("Memória do backup", { exact: true }).first().waitFor();
  if ((await page.locator("#memory-count").innerText()) !== "01") throw new Error("O backup restaurado não substituiu as memórias locais.");

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
  await mobilePage.locator("#book-opening.visible").waitFor();
  await mobilePage.screenshot({ path: path.join(artifacts, "03a-mobile-cover.png"), fullPage: false });
  await mobilePage.getByRole("button", { name: "Entrar como Pessoa A", exact: true }).click();
  await mobilePage.locator("#book-opening").waitFor({ state: "hidden" });
  const hasHorizontalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (hasHorizontalOverflow) throw new Error("A versão móvel apresenta rolagem horizontal indevida.");
  await mobilePage.screenshot({ path: path.join(artifacts, "03-mobile.png"), fullPage: false });
  await mobileContext.close();

  process.stdout.write("Fluxo validado: manifest, modo offline, acesso, capa do livro, memória com foto reduzida, sonho, carta, cápsula, bloqueio, perspectiva da pessoa amada com as duas cartas, retrospectiva, restauração de backup e layout móvel.\n");
} finally {
  await browser.close();
}
