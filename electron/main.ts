/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Electron Portable Main Process
 * Boots the bundled Express backend on a clean loopback port (3010+, excluding 3009)
 * and hosts the Vite production bundle in a native desktop window.
 */

// @ts-expect-error electron is installed on packaging hosts via electron-builder
import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { resolveWindowDecorationConfig } from './windowDecoration';

const bootDecoration = resolveWindowDecorationConfig(
  process.platform,
  process.env,
  nativeTheme?.shouldUseDarkColors ?? true
);

for (const [flag, value] of bootDecoration.chromiumSwitches) {
  if (value !== undefined) {
    app.commandLine.appendSwitch(flag, value);
  } else {
    app.commandLine.appendSwitch(flag);
  }
}

let serverProc: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

async function waitForServer(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function createWindow() {
  const serverEntry = path.join(__dirname, '..', 'dist-portable', 'server.cjs');
  const targetPort = Number(process.env.PORT || 3010);

  serverProc = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(targetPort),
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'ignore',
  });

  await waitForServer(targetPort);

  const decoration = resolveWindowDecorationConfig(
    process.platform,
    process.env,
    nativeTheme.shouldUseDarkColors
  );

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: decoration.minWidth,
    minHeight: decoration.minHeight,
    title: 'Drive Therapy',
    frame: decoration.frame,
    titleBarStyle: decoration.titleBarStyle,
    autoHideMenuBar: decoration.autoHideMenuBar,
    backgroundColor: decoration.backgroundColor,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc');
    }
  });

  await mainWindow.loadURL(`http://127.0.0.1:${targetPort}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (url.startsWith('https://accounts.google.com') || url.startsWith('https://photospicker.google.com')) {
      return { action: 'allow' };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
