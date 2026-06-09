const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────
const GITHUB_REPO    = 'Coregenetic/loot-game-center';
const API_URL        = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const VERSION_FILE   = path.join(__dirname, 'version.json');
const MAIN_HTML      = path.join(__dirname, 'Control_Center.html');
const SPLASH_HTML    = path.join(__dirname, 'splash.html');

let splashWindow = null;
let mainWindow   = null;

const PRELOAD = path.join(__dirname, 'preload.js');

// ─── Window: Splash ──────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 520,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    skipTaskbar: false,
    backgroundColor: '#050505',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(SPLASH_HTML);
  splashWindow.setTitle('Loot-Game Center — Loading');
}

// ─── Window: Main App ────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#050505',
    center: true,
    show: false,
    title: 'Loot-Game Center',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile(MAIN_HTML);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Version helpers ─────────────────────────────────────────────────────────
function getLocalVersion() {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
}

function isNewer(remote, local) {
  const parse = v => v.replace(/^v/, '').split('.').map(Number);
  const [rM, rm, rp] = parse(remote);
  const [lM, lm, lp] = parse(local);
  if (rM !== lM) return rM > lM;
  if (rm !== lm) return rm > lm;
  return rp > lp;
}

// ─── GitHub API fetch ────────────────────────────────────────────────────────
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'LootGame-Electron/1.0',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 8000
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from GitHub')); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ─── IPC: Splash communicates back to main ───────────────────────────────────
ipcMain.handle('get-local-version', () => getLocalVersion());

ipcMain.handle('check-update', async () => {
  try {
    const release = await fetchLatestRelease();
    const remote  = (release.tag_name || '').replace(/^v/, '');
    const local   = getLocalVersion();
    return {
      localVersion:  local,
      remoteVersion: remote,
      hasUpdate:     isNewer(remote, local),
      release
    };
  } catch (err) {
    return {
      localVersion:  getLocalVersion(),
      remoteVersion: null,
      hasUpdate:     false,
      error:         err.message
    };
  }
});

ipcMain.handle('launch-app', () => {
  createMainWindow();
});

ipcMain.handle('download-update', () => {
  shell.openExternal(`https://github.com/Coregenetic/loot-game-center/releases/latest`);
});

ipcMain.handle('get-app-version', () => app.getVersion());

// ─── Window controls (frameless) ─────────────────────────────────────────────
ipcMain.on('window-minimize', () => {
  const win = mainWindow || splashWindow;
  if (win) win.minimize();
});
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => {
  const win = mainWindow || splashWindow;
  if (win) win.close();
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createSplash();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createSplash();
});
