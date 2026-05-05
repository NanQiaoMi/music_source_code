const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleDesktopLyrics: () => ipcRenderer.invoke('toggle-desktop-lyrics'),
  isDesktopLyricsOpen: () => ipcRenderer.invoke('is-desktop-lyrics-open'),
  updateLyrics: (lyrics) => ipcRenderer.invoke('update-lyrics', lyrics),
  updateSongInfo: (songInfo) => ipcRenderer.invoke('update-song-info', songInfo),
  setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('set-always-on-top', alwaysOnTop),
  saveEmotions: (data) => ipcRenderer.invoke('save-emotions', data),
  loadEmotions: () => ipcRenderer.invoke('load-emotions'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  onTogglePlay: (callback) => ipcRenderer.on('toggle-play', callback),
  onPrevSong: (callback) => ipcRenderer.on('prev-song', callback),
  onNextSong: (callback) => ipcRenderer.on('next-song', callback),
  onUpdateLyrics: (callback) => ipcRenderer.on('update-lyrics', callback),
  onUpdateSongInfo: (callback) => ipcRenderer.on('update-song-info', callback),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('toggle-play');
    ipcRenderer.removeAllListeners('prev-song');
    ipcRenderer.removeAllListeners('next-song');
    ipcRenderer.removeAllListeners('update-lyrics');
    ipcRenderer.removeAllListeners('update-song-info');
  },
});

const isDesktopLyricsMode = new URLSearchParams(window.location.search).has('desktop-lyrics');

contextBridge.exposeInMainWorld('isDesktopLyricsMode', isDesktopLyricsMode);
