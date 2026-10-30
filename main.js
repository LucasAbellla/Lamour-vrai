const { app, BrowserWindow, Menu, dialog, session, shell } = require("electron");
const path = require("path");

// O app instalado abre o site publicado: toda correção chega sozinha, e nenhuma chave ou
// conteúdo particular precisa ir dentro do instalador. O cofre continua cifrado no aparelho.
const SITE_URL = "https://lamour-vrai.pages.dev/";
const startUrl = app.isPackaged ? SITE_URL : process.env.ELECTRON_START_URL;
const UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const UPDATE_FOCUS_PAUSE_MS = 20 * 1000;

// Usa a placa de vídeo mesmo quando o Chromium desconfia do driver: sem ela, os efeitos travam a tela.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");

let mainWindow = null;

function isOwnPage(url) {
  if (!startUrl) return url.startsWith("file:");
  return new URL(url).origin === new URL(startUrl).origin;
}

function openOutside(url) {
  if (url.startsWith("https:")) void shell.openExternal(url);
}

function openSite(window) {
  if (startUrl) void window.loadURL(startUrl);
  else void window.loadFile(path.join(__dirname, "dist", "index.html"));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 360,
    minHeight: 640,
    show: false,
    backgroundColor: "#0c0506",
    title: "L'amour vrai",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => { mainWindow = null; });

  // Só o próprio site abre aqui dentro; qualquer outro endereço vai para o navegador.
  window.webContents.on("will-navigate", (event, url) => {
    if (isOwnPage(url)) return;
    event.preventDefault();
    openOutside(url);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: "deny" };
  });

  window.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !startUrl) return;
    void window.loadFile(path.join(__dirname, "desktop", "offline.html"), { query: { site: startUrl } });
  });

  // Sem menu, estes atalhos seriam perdidos.
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
      event.preventDefault();
      window.webContents.reload();
    } else if (input.key === "F11") {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    }
  });

  openSite(window);
  return window;
}

// O que muda no site chega pela própria página. Já o que muda no app sai como uma versão no
// GitHub: ele confere ao abrir, ao voltar para a janela e a cada 10 minutos, e baixa sozinho.
function setupUpdates() {
  const { autoUpdater } = require("electron-updater");
  let lastCheck = 0;
  let announced = null;

  const check = () => {
    lastCheck = Date.now();
    autoUpdater.checkForUpdates().catch(() => {});
  };

  // Sem internet a busca falha, e a próxima tentativa resolve.
  autoUpdater.on("error", () => {});
  autoUpdater.on("update-downloaded", async ({ version }) => {
    if (announced === version) return;
    announced = version;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "L'amour vrai",
      message: "Nova versão do L'amour vrai",
      detail: "Está tudo pronto. O app fecha e volta sozinho em alguns segundos.",
      buttons: ["Atualizar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (response === 0) autoUpdater.quitAndInstall(true, true);
  });

  app.on("browser-window-focus", () => {
    if (Date.now() - lastCheck >= UPDATE_FOCUS_PAUSE_MS) check();
  });
  setInterval(check, UPDATE_INTERVAL_MS);
  check();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, respond) => respond(false));
    mainWindow = createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
    if (app.isPackaged) setupUpdates();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
