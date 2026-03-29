import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { registerAppIpcHandlers } from './ipc-handlers.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    if (process.env.OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

function registerIpcHandlers(): void {
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow.close());

  ipcMain.handle('dialog:save', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
  });

  // export:image — Save a base64 PNG data URL to a file
  ipcMain.handle('export:image', async (_event, params: { imageData: string; outputPath: string }) => {
    const base64 = params.imageData.replace(/^data:image\/png;base64,/, '');
    await writeFile(params.outputPath, Buffer.from(base64, 'base64'));
    return params.outputPath;
  });

  // export:pdf — Capture the current window as PDF
  ipcMain.handle('export:pdf', async (_event, outputPath: string) => {
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      landscape: true,
    });
    await writeFile(outputPath, pdfData);
    return outputPath;
  });
}

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();
  registerAppIpcHandlers(() => mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
