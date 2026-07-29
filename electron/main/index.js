const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, protocol, net, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("node:http");
const nodeNet = require("node:net");
const { pathToFileURL } = require("node:url");
const { spawn } = require("child_process");
const { resolveStaticPath } = require("./staticPath");
const pluginManager = require("./pluginManager");

const DEFAULT_BACKEND_HOST = "127.0.0.1";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let desktopLyricsWindow = null;
let tray = null;
let backendProcess = null;
let backendState = {
  status: "disabled",
  baseUrl: null,
  error: null,
};

const outDirectory = () => path.join(__dirname, "../../out");

async function registerAppProtocol() {
  protocol.handle("app", async (request) => {
    const target = resolveStaticPath(request.url, outDirectory());
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(target).toString());
  });
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = nodeNet.createServer();
    server.once("error", reject);
    server.listen(0, DEFAULT_BACKEND_HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => (port ? resolve(port) : reject(new Error("无法分配后端端口"))));
    });
  });
}

function checkBackendHealth(baseUrl) {
  return new Promise((resolve) => {
    const request = http.get(`${baseUrl}/api/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function waitForBackend(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkBackendHealth(baseUrl)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function startBackend() {
  if (!app.isPackaged) {
    backendState = { status: "external", baseUrl: `http://${DEFAULT_BACKEND_HOST}:8000`, error: null };
    console.log("开发模式：跳过内置后端启动，请运行 npm run backend");
    return true;
  }

  const backendPath = path.join(process.resourcesPath, "backend.exe");
  if (!fs.existsSync(backendPath)) {
    backendState = {
      status: "error",
      baseUrl: null,
      error: `未找到内置后端：${backendPath}`,
    };
    console.error(backendState.error);
    return false;
  }

  const port = await findAvailablePort();
  const baseUrl = `http://${DEFAULT_BACKEND_HOST}:${port}`;
  backendState = { status: "starting", baseUrl, error: null };

  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    env: {
      ...process.env,
      VIBE_HOST: DEFAULT_BACKEND_HOST,
      VIBE_PORT: String(port),
      VIBE_MODELS_DIR: path.join(app.getPath("userData"), "models"),
    },
    stdio: "ignore",
    windowsHide: true,
  });

  backendProcess.once("error", (error) => {
    backendState = { status: "error", baseUrl: null, error: error.message };
    console.error("后端启动失败:", error);
  });
  backendProcess.once("exit", (code) => {
    if (backendState.status !== "stopping") {
      backendState = {
        status: "error",
        baseUrl: null,
        error: `后端进程已退出（代码 ${code ?? "unknown"}）`,
      };
    }
    backendProcess = null;
  });

  if (!(await waitForBackend(baseUrl))) {
    backendState = {
      status: "error",
      baseUrl: null,
      error: "内置后端未能在 30 秒内通过健康检查，请检查端口占用或安全软件拦截。",
    };
    stopBackend();
    console.error(backendState.error);
    return false;
  }

  backendState = { status: "ready", baseUrl, error: null };
  console.log("内置后端已就绪:", baseUrl);
  return true;
}

function stopBackend() {
  if (!backendProcess) return;
  backendState = { ...backendState, status: "stopping" };
  try {
    backendProcess.kill();
  } catch (error) {
    console.error("停止后端失败:", error);
  }
  backendProcess = null;
}

function configureWindowSecurity(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("app://app/")) {
      return { action: "allow" };
    }
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const isDevelopment = !app.isPackaged && url.startsWith("http://localhost:3025");
    if (!url.startsWith("app://app/") && !isDevelopment) {
      event.preventDefault();
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    transparent: false,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "../../public/app-icon.ico"),
  });
  configureWindowSecurity(mainWindow);

  if (app.isPackaged) {
    mainWindow.loadURL("app://app/");
  } else {
    mainWindow.loadURL("http://localhost:3025");
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.close();
    }
    if (process.platform !== "darwin") app.quit();
  });
}

function createDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.show();
    return;
  }

  desktopLyricsWindow = new BrowserWindow({
    width: 600,
    height: 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: true });
  configureWindowSecurity(desktopLyricsWindow);

  if (app.isPackaged) {
    desktopLyricsWindow.loadURL("app://app/?desktop-lyrics=true");
  } else {
    desktopLyricsWindow.loadURL("http://localhost:3025?desktop-lyrics=true");
  }

  desktopLyricsWindow.on("closed", () => {
    desktopLyricsWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "../../public/app-icon.ico");
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "桌面歌词",
      type: "checkbox",
      checked: desktopLyricsWindow && !desktopLyricsWindow.isDestroyed(),
      click: (menuItem) => {
        if (menuItem.checked) createDesktopLyricsWindow();
        else if (desktopLyricsWindow) desktopLyricsWindow.close();
      },
    },
    { type: "separator" },
    {
      label: "播放/暂停",
      click: () => mainWindow?.webContents.send("toggle-play"),
    },
    {
      label: "上一首",
      click: () => mainWindow?.webContents.send("prev-song"),
    },
    {
      label: "下一首",
      click: () => mainWindow?.webContents.send("next-song"),
    },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]);

  tray.setToolTip("Vibe Music Player");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

ipcMain.handle("toggle-desktop-lyrics", () => {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.close();
    return false;
  }
  createDesktopLyricsWindow();
  return true;
});

ipcMain.handle("is-desktop-lyrics-open", () => Boolean(desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()));
ipcMain.handle("get-backend-status", () => backendState);
ipcMain.handle("update-lyrics", (event, lyrics) => {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.webContents.send("update-lyrics", lyrics);
  }
});
ipcMain.handle("update-song-info", (event, songInfo) => {
  if (tray) tray.setToolTip(`${songInfo.title} - ${songInfo.artist}`);
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.webContents.send("update-song-info", songInfo);
  }
});
ipcMain.handle("set-always-on-top", (event, alwaysOnTop) => {
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
});
ipcMain.handle("toggle-fullscreen", () => {
  if (!mainWindow) return false;
  const isFullScreen = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFullScreen);
  return !isFullScreen;
});

const EMOTIONS_FILE_PATH = path.join(app.getPath("userData"), ".vibe_emotions.json");
ipcMain.handle("save-emotions", async (event, data) => {
  try {
    await fs.promises.writeFile(EMOTIONS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Error saving emotions:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("load-emotions", async () => {
  try {
    if (!fs.existsSync(EMOTIONS_FILE_PATH)) return {};
    return JSON.parse(await fs.promises.readFile(EMOTIONS_FILE_PATH, "utf-8"));
  } catch (error) {
    console.error("Error loading emotions:", error);
    return {};
  }
});

ipcMain.handle("plugins:search", async (event, query, page, type) =>
  pluginManager.search(query, page, type)
);
ipcMain.handle("plugins:getMediaSource", async (event, musicItem, quality) =>
  pluginManager.getMediaSource(musicItem, quality)
);
ipcMain.handle("plugins:getLyric", async (event, musicItem) => pluginManager.getLyric(musicItem));
ipcMain.handle("plugins:list", async () => pluginManager.listPlugins());
ipcMain.handle("plugins:load", async () => {
  await pluginManager.loadPlugins();
  return pluginManager.listPlugins();
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(async () => {
    await registerAppProtocol();
    await pluginManager.loadPlugins();
    await startBackend();
    createMainWindow();
    createTray();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackend();
  tray?.destroy();
});
