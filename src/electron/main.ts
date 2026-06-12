import { BackWatch } from "@linkasu/tobii-electron/main";
import { app, BrowserWindow } from "electron";
import { join } from "path";

let mainWindow: BrowserWindow | undefined;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const devSession = process.env.LINKA_DEV_SESSION;
if (devSession) {
  app.setPath("userData", join(app.getPath("userData"), devSession));
}

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
  if (process.env.LINKA_NO_TOBII !== "1") {
    const backWatch = new BackWatch(win, {
      socketName: process.env.LINKA_TOBII_SOCKET_NAME ?? "su.linka.plays.tobiifree",
      showStartupError: false
    });
    void backWatch;
  }
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
