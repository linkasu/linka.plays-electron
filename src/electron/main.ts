import { BackWatch } from "@linkasu/tobii-electron/main";
import { app, BrowserWindow } from "electron";
import { join } from "path";

let mainWindow: BrowserWindow | undefined;

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#fbf7ef",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = win;
  const backWatch = new BackWatch(win, {
    socketName: "su.linka.plays.tobiifree",
    showStartupError: false
  });
  void backWatch;
  win.on("closed", () => {
    mainWindow = undefined;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  await createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
