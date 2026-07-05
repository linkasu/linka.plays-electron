import { app, ipcMain } from "electron";

const defaultUploadUrl = "https://linka.su/linka-plays-debug/upload/?token=9f5ae86a31625f7101f0dc0a4db7a1da735d";
const maxPayloadBytes = 900 * 1024;

type DiagnosticsUploadPayload = {
  kind?: string;
  [key: string]: unknown;
};

export function registerDiagnosticsHandlers() {
  ipcMain.handle("diagnostics:upload", async (_event, payload: DiagnosticsUploadPayload) => {
    const endpoint = process.env.LINKA_DIAGNOSTICS_URL || defaultUploadUrl;
    const body = JSON.stringify({
      app: {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
      },
      sentAt: new Date().toISOString(),
      payload
    });

    if (Buffer.byteLength(body, "utf8") > maxPayloadBytes) {
      throw new Error("Диагностический отчёт слишком большой");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Загрузка диагностики не удалась: ${response.status} ${text}`);
    }
    try {
      return JSON.parse(text) as { ok: boolean; id?: string };
    } catch {
      return { ok: true, id: text.trim() };
    }
  });
}
