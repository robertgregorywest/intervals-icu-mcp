// Deno-only. Encrypted token store for the remote MCP transport.
// Maps a server-issued OAuth identity -> the user's Intervals.icu OAuth tokens.
// Tokens are encrypted at rest with AES-GCM (Web Crypto); the master key comes
// from the TOKEN_ENC_KEY env var (base64-encoded 32 bytes).
//
// See ADR 0006 (federated OAuth) and ADR 0007 (Deno runtime).

/** The Intervals.icu OAuth credential set held for one connected user. */
export interface IcuTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when accessToken expires; drives the refresh path in HttpClient. */
  expiresAt: number;
  scope: string;
}

interface StoredRecord {
  iv: string; // base64
  ciphertext: string; // base64
}

const KEY_PREFIX = ["icu_tokens"] as const;

function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of view) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function loadKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("TOKEN_ENC_KEY");
  if (!raw) {
    throw new Error(
      "TOKEN_ENC_KEY env var is required (base64-encoded 32 bytes)"
    );
  }
  const keyBytes = b64decode(raw);
  if (keyBytes.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must decode to exactly 32 bytes");
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export class TokenStore {
  private constructor(
    private kv: Deno.Kv,
    private key: CryptoKey
  ) {}

  static async open(path?: string): Promise<TokenStore> {
    const [kv, key] = await Promise.all([Deno.openKv(path), loadKey()]);
    return new TokenStore(kv, key);
  }

  async put(userId: string, tokens: IcuTokens): Promise<void> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(tokens));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      plaintext
    );
    const record: StoredRecord = {
      iv: b64encode(iv),
      ciphertext: b64encode(ciphertext),
    };
    await this.kv.set([...KEY_PREFIX, userId], record);
  }

  async get(userId: string): Promise<IcuTokens | null> {
    const entry = await this.kv.get<StoredRecord>([...KEY_PREFIX, userId]);
    if (!entry.value) return null;
    const iv = b64decode(entry.value.iv);
    const ciphertext = b64decode(entry.value.ciphertext);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.key,
      ciphertext
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as IcuTokens;
  }

  async delete(userId: string): Promise<void> {
    await this.kv.delete([...KEY_PREFIX, userId]);
  }

  close(): void {
    this.kv.close();
  }
}
