const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let desktopLyricsWindow = null;
let tray = null;

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
    icon: path.join(__dirname, '../../public/default-cover.svg'),
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3025');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../.next/index.html'));
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
    desktopLyricsWindow.loadFile(path.join(__dirname, '../../.next/index.html'), {
      query: { 'desktop-lyrics': 'true' },
    });
  }

  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../public/default-cover.svg');
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
  if (tray) {
    tray.destroy();
  }
});
