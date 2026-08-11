import { randomUUID } from "crypto";
import { safeStorage } from "electron";
import { chmod, mkdir, open, readFile, readdir, rename, rm } from "fs/promises";
import { basename, join } from "path";
import type { AppMetadata } from "./types";

type JSONResponse = { ok: boolean; status: number; body: unknown };
export type TelemetryRequest = (input: string, init: RequestInit) => Promise<JSONResponse>;

type AccessToken = {
  token: string;
  expiresAt: string;
};

export type InstallationIdentity = {
  installationKey: string;
  refreshToken: string;
  refreshExpiresAt: string;
  policyVersion: string;
  accessToken?: AccessToken;
};

type StoredIdentity = {
  schema_version: 2;
  installation_key: string;
  credentials: string;
  protected: boolean;
};

type RegistrationAttempt = {
  request_id: string;
  product_id: "linka-plays";
  platform: AppMetadata["platform"];
  preference: "allowed";
  policy_version: string;
  recorded_at: string;
};

type IdentityClientOptions = {
  directory: string;
  endpoint: string;
  platform: AppMetadata["platform"];
  policyVersion: string;
};

export class TelemetryDeniedError extends Error {
  constructor() {
    super("telemetry denied");
    this.name = "TelemetryDeniedError";
  }
}

export class PublicInstallationIdentityClient {
  private readonly identityPath: string;
  private readonly registrationPath: string;
  private identityLoaded = false;
  private identityUnavailable = false;
  private identity?: InstallationIdentity;

  constructor(private readonly options: IdentityClientOptions) {
    this.identityPath = join(options.directory, "installation.json");
    this.registrationPath = join(options.directory, "registration.json");
  }

  async getAccess(request: TelemetryRequest): Promise<InstallationIdentity> {
    const identity = await this.getIdentity(request);
    if (identity.accessToken && Date.parse(identity.accessToken.expiresAt) > Date.now() + 60_000) return identity;

    const response = await request(endpointURL(this.options.endpoint, "/v1/public/installations/token"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${identity.refreshToken}` },
      body: "{}"
    });
    if (response.status === 403) throw new TelemetryDeniedError();
    if (response.status === 401) throw new Error("installation refresh credential rejected");
    if (!response.ok) throw new Error("installation token refresh rejected");
    const refreshed = parseTokenResponse(response.body, identity.installationKey);
    identity.accessToken = refreshed;
    await this.save(identity);
    return identity;
  }

  async invalidateAccess() {
    await this.load();
    if (!this.identity?.accessToken) return;
    this.identity.accessToken = undefined;
    await this.save(this.identity);
  }

  async deny(request: TelemetryRequest) {
    await this.load();
    if (this.identityUnavailable) return false;
    if (!this.identity) {
      const pending = await this.readRegistration(false);
      if (!pending) {
        await this.clear();
        return true;
      }
      if (!isRecentDate(pending.recorded_at)) {
        // No credential was persisted, so this client could not have submitted telemetry for this attempt.
        await this.clear();
        return true;
      }
      const registration = await request(endpointURL(this.options.endpoint, "/v1/public/installations"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pending)
      });
      if (!registration.ok) return false;
      this.identity = parseRegistrationResponse(registration.body, pending.policy_version, this.options.platform);
      await this.save(this.identity);
    }
    const response = await request(endpointURL(this.options.endpoint, "/v1/public/installations/telemetry-preference"), {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.identity.refreshToken}` },
      body: JSON.stringify({ preference: "denied", policy_version: this.identity.policyVersion, recorded_at: new Date().toISOString() })
    });
    if (response.status === 200 && isDenialResponse(response.body, this.identity.installationKey, this.identity.policyVersion)) {
      await this.clear();
      return true;
    }
    return false;
  }

  async clear() {
    this.identity = undefined;
    this.identityLoaded = true;
    this.identityUnavailable = false;
    await Promise.all([rm(this.identityPath, { force: true }), rm(this.registrationPath, { force: true })]);
  }

  private async getIdentity(request: TelemetryRequest) {
    await this.load();
    if (this.identityUnavailable) throw new Error("stored installation credential is unavailable");
    if (this.identity) return this.identity;

    const registration = await this.loadRegistration();
    const response = await request(endpointURL(this.options.endpoint, "/v1/public/installations"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(registration)
    });
    if (!response.ok) throw new Error("installation registration rejected");
    const identity = parseRegistrationResponse(response.body, registration.policy_version, this.options.platform);
    this.identity = identity;
    this.identityLoaded = true;
    await this.save(identity);
    await rm(this.registrationPath, { force: true });
    return identity;
  }

  private async load() {
    if (this.identityLoaded) return;
    this.identityLoaded = true;
    let contents: string;
    try {
      contents = await readRecoverable(this.options.directory, this.identityPath);
    } catch (error) {
      if (!isMissingFileError(error)) this.identityUnavailable = true;
      return;
    }
    let stored: Partial<StoredIdentity> & Record<string, unknown>;
    try {
      stored = JSON.parse(contents) as Partial<StoredIdentity> & Record<string, unknown>;
    } catch {
      this.identityUnavailable = true;
      return;
    }
    if (isLegacyIdentity(stored)) {
      await rm(this.identityPath, { force: true });
      return;
    }
    if (stored.schema_version !== 2 || !isOpaqueKey(stored.installation_key) || typeof stored.credentials !== "string" || typeof stored.protected !== "boolean") {
      this.identityUnavailable = true;
      return;
    }
    let credentials = stored.credentials;
    if (stored.protected) {
      if (!safeStorage.isEncryptionAvailable()) {
        this.identityUnavailable = true;
        return;
      }
      try {
        credentials = safeStorage.decryptString(Buffer.from(credentials, "base64"));
      } catch {
        this.identityUnavailable = true;
        return;
      }
    }
    try {
      const parsed = JSON.parse(credentials) as Record<string, unknown>;
      this.identity = parseStoredIdentity(stored.installation_key, parsed);
      if (!this.identity) this.identityUnavailable = true;
    } catch {
      this.identityUnavailable = true;
    }
  }

  private async loadRegistration(): Promise<RegistrationAttempt> {
    const pending = await this.readRegistration();
    if (pending) return pending;
    if (await this.readRegistration(false)) await rm(this.registrationPath, { force: true });
    const registration: RegistrationAttempt = {
      request_id: randomUUID(),
      product_id: "linka-plays",
      platform: this.options.platform,
      preference: "allowed",
      policy_version: this.options.policyVersion,
      recorded_at: new Date().toISOString()
    };
    await atomicWrite(this.options.directory, this.registrationPath, JSON.stringify(registration));
    return registration;
  }

  private async readRegistration(recentOnly = true): Promise<RegistrationAttempt | undefined> {
    try {
      const parsed = JSON.parse(await readRecoverable(this.options.directory, this.registrationPath)) as Partial<RegistrationAttempt>;
      if (isUUID(parsed.request_id) && parsed.product_id === "linka-plays" && parsed.platform === this.options.platform && parsed.preference === "allowed" && parsed.policy_version === this.options.policyVersion && isDate(parsed.recorded_at) && (!recentOnly || isRecentDate(parsed.recorded_at))) {
        return parsed as RegistrationAttempt;
      }
    } catch {
      // Missing and stale attempts are replaced only when registration is requested.
    }
    return undefined;
  }

  private async save(identity: InstallationIdentity) {
    const credentials = JSON.stringify({
      refresh_token: identity.refreshToken,
      refresh_expires_at: identity.refreshExpiresAt,
      policy_version: identity.policyVersion,
      access_token: identity.accessToken?.token,
      access_expires_at: identity.accessToken?.expiresAt
    });
    let protectedCredentials = false;
    let value = credentials;
    if (safeStorage.isEncryptionAvailable()) {
      try {
        value = safeStorage.encryptString(credentials).toString("base64");
        protectedCredentials = true;
      } catch {
        protectedCredentials = false;
      }
    }
    const stored: StoredIdentity = { schema_version: 2, installation_key: identity.installationKey, credentials: value, protected: protectedCredentials };
    await atomicWrite(this.options.directory, this.identityPath, JSON.stringify(stored));
  }
}

function parseRegistrationResponse(value: unknown, policyVersion: string, platform: AppMetadata["platform"]): InstallationIdentity {
  if (!isObject(value) || !isOpaqueKey(value.installation_key) || value.product !== "linka-plays" || value.platform !== platform || value.preference !== "allowed" || value.policy_version !== policyVersion || typeof value.refresh_token !== "string" || value.refresh_token.length < 100 || value.refresh_token.length > 4096 || !isDate(value.refresh_expires_at)) {
    throw new Error("invalid installation registration");
  }
  return {
    installationKey: value.installation_key,
    refreshToken: value.refresh_token,
    refreshExpiresAt: value.refresh_expires_at,
    policyVersion,
    accessToken: parseAccessToken(value.metrics_token)
  };
}

function parseTokenResponse(value: unknown, installationKey: string) {
  if (!isObject(value) || value.installation_key !== installationKey || value.product !== "linka-plays") throw new Error("invalid installation token response");
  const access = parseAccessToken(value.metrics_token);
  if (!access) throw new Error("missing installation access token");
  return access;
}

function parseAccessToken(value: unknown): AccessToken | undefined {
  if (!isObject(value) || typeof value.access_token !== "string" || value.access_token.length < 100 || value.access_token.length > 4096 || value.token_type !== "Bearer" || !isDate(value.expires_at)) return undefined;
  return { token: value.access_token, expiresAt: value.expires_at };
}

function parseStoredIdentity(installationKey: string, value: Record<string, unknown>): InstallationIdentity | undefined {
  if (typeof value.refresh_token !== "string" || value.refresh_token.length < 100 || value.refresh_token.length > 4096 || !isDate(value.refresh_expires_at) || typeof value.policy_version !== "string" || !value.policy_version) return undefined;
  const accessToken = value.access_token === undefined && value.access_expires_at === undefined
    ? undefined
    : parseAccessToken({ access_token: value.access_token, expires_at: value.access_expires_at, token_type: "Bearer" });
  return { installationKey, refreshToken: value.refresh_token, refreshExpiresAt: value.refresh_expires_at, policyVersion: value.policy_version, accessToken };
}

function endpointURL(base: string, path: string) {
  const url = new URL(base);
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) throw new Error("invalid identity endpoint");
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function atomicWrite(directory: string, destination: string, contents: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(contents, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  if (process.platform === "win32") await rm(destination, { force: true });
  await rename(temporary, destination);
  await chmod(destination, 0o600);
  try {
    const handle = await open(directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Directory fsync is unavailable on some supported filesystems.
  }
}

async function readRecoverable(directory: string, destination: string) {
  try {
    return await readFile(destination, "utf8");
  } catch (error) {
    if (process.platform !== "win32") throw error;
    const prefix = `${basename(destination)}.`;
    const candidates = (await readdir(directory)).filter((name) => name.startsWith(prefix) && name.endsWith(".tmp")).sort().reverse();
    for (const candidate of candidates) {
      try {
        const temporary = join(directory, candidate);
        const contents = await readFile(temporary, "utf8");
        await rename(temporary, destination);
        return contents;
      } catch {
        // Try the next complete temporary file.
      }
    }
    throw error;
  }
}

function isDenialResponse(value: unknown, installationKey: string, policyVersion: string) {
  return isObject(value) && value.installation_key === installationKey && value.product === "linka-plays" && value.preference === "denied" && value.policy_version === policyVersion && isDate(value.recorded_at);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isRecentDate(value: unknown): value is string {
  return isDate(value) && Date.parse(value) > Date.now() - 23 * 60 * 60 * 1000 && Date.parse(value) < Date.now() + 5 * 60 * 1000;
}

function isOpaqueKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isUUID(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isLegacyIdentity(value: Record<string, unknown>) {
  return value.schema_version === undefined && isUUID(value.installation_id) && typeof value.token === "string";
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
