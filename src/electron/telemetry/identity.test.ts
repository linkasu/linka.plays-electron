import { mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicInstallationIdentityClient, type TelemetryRequest } from "./identity";

vi.mock("electron", () => ({ safeStorage: { isEncryptionAvailable: () => false } }));

const directories: string[] = [];
const installationKey = "a".repeat(64);
const refreshToken = "refresh." + "r".repeat(120);
const accessToken = "access." + "a".repeat(120);

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("PublicInstallationIdentityClient", () => {
  it("reuses the exact registration request after response loss", async () => {
    const client = await createClient();
    const bodies: string[] = [];
    const request = vi.fn<TelemetryRequest>(async (_input, init) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) throw new Error("response lost");
      return jsonResponse(201, registration());
    });

    await expect(client.getAccess(request)).rejects.toThrow("response lost");
    await expect(client.getAccess(request)).resolves.toMatchObject({ installationKey, accessToken: { token: accessToken } });

    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
  });

  it("refreshes an expiring access token without replacing the installation", async () => {
    const client = await createClient();
    const refreshedToken = "refreshed." + "b".repeat(120);
    const request = vi.fn<TelemetryRequest>(async (input) => {
      if (input.endsWith("/v1/public/installations")) return jsonResponse(201, registration(1));
      return jsonResponse(200, { installation_key: installationKey, product: "linka-plays", metrics_token: token(refreshedToken) });
    });

    const identity = await client.getAccess(request);

    expect(identity.installationKey).toBe(installationKey);
    expect(identity.accessToken?.token).toBe(refreshedToken);
    expect(request.mock.calls.map(([input]) => input)).toEqual([
      "https://identity.example.test/v1/public/installations",
      "https://identity.example.test/v1/public/installations/token"
    ]);
  });

  it("exact-replays a pending registration before denial", async () => {
    const client = await createClient();
    const registrationBodies: string[] = [];
    const failedRegistration = vi.fn<TelemetryRequest>(async (_input, init) => {
      registrationBodies.push(String(init.body));
      throw new Error("response lost");
    });
    await expect(client.getAccess(failedRegistration)).rejects.toThrow("response lost");

    const denialRequest = vi.fn<TelemetryRequest>(async (input, init) => {
      if (input.endsWith("/v1/public/installations")) {
        registrationBodies.push(String(init.body));
        return jsonResponse(201, registration());
      }
      return jsonResponse(200, { installation_key: installationKey, product: "linka-plays", preference: "denied", policy_version: "2026-07-19-v3", recorded_at: new Date().toISOString() });
    });

    await expect(client.deny(denialRequest)).resolves.toBe(true);
    expect(registrationBodies[1]).toBe(registrationBodies[0]);
    await expect(stat(join(clientDirectory(client), "installation.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps the credential when denial is temporarily unavailable", async () => {
    const client = await createClient();
    await client.getAccess(async () => jsonResponse(201, registration()));

    await expect(client.deny(async () => jsonResponse(503, { error: "unavailable" }))).resolves.toBe(false);

    const stored = JSON.parse(await readFile(join(clientDirectory(client), "installation.json"), "utf8")) as { schema_version: number; installation_key: string };
    expect(stored).toMatchObject({ schema_version: 2, installation_key: installationKey });
  });

  it.each([401, 403])("does not claim denial after HTTP %s", async (status) => {
    const client = await createClient();
    await client.getAccess(async () => jsonResponse(201, registration()));

    await expect(client.deny(async () => jsonResponse(status, { error: "denial_not_confirmed" }))).resolves.toBe(false);

    await expect(stat(join(clientDirectory(client), "installation.json"))).resolves.toBeDefined();
  });

  it("rejects a mismatched successful denial response", async () => {
    const client = await createClient();
    await client.getAccess(async () => jsonResponse(201, registration()));

    await expect(client.deny(async () => jsonResponse(200, { installation_key: "b".repeat(64), product: "linka-plays", preference: "denied", policy_version: "2026-07-19-v3", recorded_at: new Date().toISOString() }))).resolves.toBe(false);

    await expect(stat(join(clientDirectory(client), "installation.json"))).resolves.toBeDefined();
  });

  it("does not replace an unreadable V2 credential with a new installation", async () => {
    const client = await createClient();
    await writeFile(join(clientDirectory(client), "installation.json"), "{broken", { mode: 0o600 });
    const request = vi.fn<TelemetryRequest>();

    await expect(client.getAccess(request)).rejects.toThrow("stored installation credential is unavailable");
    await expect(client.deny(request)).resolves.toBe(false);

    expect(request).not.toHaveBeenCalled();
    await expect(readFile(join(clientDirectory(client), "installation.json"), "utf8")).resolves.toBe("{broken");
  });

  it("replaces only a recognized legacy V1 identity during the hard switch", async () => {
    const client = await createClient();
    await writeFile(join(clientDirectory(client), "installation.json"), JSON.stringify({ installation_id: "9d51fb86-530c-4926-b627-4e42074b85db", token: "legacy-token", protected: false }), { mode: 0o600 });
    const request = vi.fn<TelemetryRequest>(async () => jsonResponse(201, registration()));

    await expect(client.getAccess(request)).resolves.toMatchObject({ installationKey });

    expect(request).toHaveBeenCalledOnce();
    const stored = JSON.parse(await readFile(join(clientDirectory(client), "installation.json"), "utf8")) as { schema_version: number };
    expect(stored.schema_version).toBe(2);
  });
});

async function createClient() {
  const directory = await mkdtemp(join(tmpdir(), "linka-identity-client-"));
  directories.push(directory);
  const client = new PublicInstallationIdentityClient({ directory, endpoint: "https://identity.example.test", platform: "linux", policyVersion: "2026-07-19-v3" });
  Object.defineProperty(client, "__testDirectory", { value: directory });
  return client;
}

function clientDirectory(client: PublicInstallationIdentityClient) {
  return (client as PublicInstallationIdentityClient & { __testDirectory: string }).__testDirectory;
}

function registration(expiresInMs = 300000) {
  return {
    installation_key: installationKey,
    product: "linka-plays",
    platform: "linux",
    preference: "allowed",
    policy_version: "2026-07-19-v3",
    recorded_at: new Date().toISOString(),
    refresh_token: refreshToken,
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
    metrics_token: token(accessToken, expiresInMs)
  };
}

function token(value = accessToken, expiresInMs = 300000) {
  return { access_token: value, token_type: "Bearer", expires_at: new Date(Date.now() + expiresInMs).toISOString() };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, body };
}
