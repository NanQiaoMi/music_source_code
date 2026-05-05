const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let desktopLyricsWindow = null;
let tray = null;
let backendProcess = null;

function startBackend() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log('开发模式：跳过后端启动，请手动启动后端');
    return;
  }

  // 生产模式：启动打包后的后端
  const backendPath = path.join(process.resourcesPath, 'backend.exe');

  // 检查后端文件是否存在
  if (!fs.existsSync(backendPath)) {
    // 尝试从应用目录查找
    const altPath = path.join(app.getAppPath(), 'backend.exe');
    if (fs.existsSync(altPath)) {
      console.log('启动后端服务:', altPath);
      backendProcess = spawn(altPath, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      console.warn('后端可执行文件不存在，部分功能可能不可用');
      return;
    }
  } else {
    console.log('启动后端服务:', backendPath);
    backendProcess = spawn(backendPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  }

  backendProcess.unref();

  backendProcess.on('error', (err) => {
    console.error('后端启动失败:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log('后端进程退出，代码:', code);
    backendProcess = null;
  });

  console.log('后端服务启动中...');
}

function stopBackend() {
  if (backendProcess) {
    console.log('停止后端服务...');
    try {
      backendProcess.kill();
    } catch (err) {
      console.error('停止后端失败:', err);
    }
    backendProcess = null;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    transparent: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../../public/logo.svg'),
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3025');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.close();
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
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
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: true });

  if (process.env.NODE_ENV === 'development') {
    desktopLyricsWindow.loadURL('http://localhost:3025?desktop-lyrics=true');
  } else {
    desktopLyricsWindow.loadFile(path.join(__dirname, '../../out/index.html'), {
      query: { 'desktop-lyrics': 'true' },
    });
  }

  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../public/logo.svg');
  const trayIcon = nativeImage.createFromPath(iconPath);

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '桌面歌词',
      type: 'checkbox',
      checked: desktopLyricsWindow && !desktopLyricsWindow.isDestroyed(),
      click: (menuItem) => {
        if (menuItem.checked) {
          createDesktopLyricsWindow();
        } else if (desktopLyricsWindow) {
          desktopLyricsWindow.close();
        }
      },
    },
    { type: 'separator' },
    {
      label: '播放/暂停',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-play');
        }
      },
    },
    {
      label: '上一首',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('prev-song');
        }
      },
    },
    {
      label: '下一首',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('next-song');
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Vibe Music Player');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

ipcMain.handle('toggle-desktop-lyrics', () => {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.close();
    return false;
  } else {
    createDesktopLyricsWindow();
    return true;
  }
});

ipcMain.handle('is-desktop-lyrics-open', () => {
  return desktopLyricsWindow && !desktopLyricsWindow.isDestroyed();
});

ipcMain.handle('update-lyrics', (event, lyrics) => {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.webContents.send('update-lyrics', lyrics);
  }
});

ipcMain.handle('update-song-info', (event, songInfo) => {
  if (tray) {
    tray.setToolTip(`${songInfo.title} - ${songInfo.artist}`);
  }
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.webContents.send('update-song-info', songInfo);
  }
});

ipcMain.handle('set-always-on-top', (event, alwaysOnTop) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(alwaysOnTop);
  }
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    return !isFullScreen;
  }
  return false;
});

// Emotion Data Persistence
const EMOTIONS_FILE_PATH = path.join(app.getPath('userData'), '.vibe_emotions.json');

ipcMain.handle('save-emotions', async (event, data) => {
  try {
    await fs.promises.writeFile(EMOTIONS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving emotions:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-emotions', async () => {
  try {
    if (!fs.existsSync(EMOTIONS_FILE_PATH)) {
      return {};
    }
    const content = await fs.promises.readFile(EMOTIONS_FILE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading emotions:', error);
    return {};
  }
});

app.whenReady().then(() => {
  startBackend();
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
  if (tray) {
    tray.destroy();
  }
});
