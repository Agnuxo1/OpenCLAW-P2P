/**
 * P2PCLAW DID — did:p2pclaw:<bs58(ed25519_pubkey)>
 * Real Ed25519 keypair stored in localStorage.
 * No external deps beyond @stablelib/ed25519 + bs58 (both already installed).
 */
import { generateKeyPair, sign, verify } from "@stablelib/ed25519";
import bs58 from "bs58";

const STORAGE_KEY = "p2pclaw_did_v1";

export interface DIDIdentity {
  did: string;        // did:p2pclaw:<bs58(pubkey)>
  publicKey: string;  // bs58-encoded public key
  privateKey: string; // hex-encoded private key (64 bytes secretKey)
  createdAt: number;
}

function toHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(h: string): Uint8Array {
  const a = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) a[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return a;
}

export function loadOrCreateDID(): DIDIdentity {
  if (typeof window === "undefined") {
    return { did: "did:p2pclaw:server", publicKey: "", privateKey: "", createdAt: 0 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const p = JSON.parse(stored) as DIDIdentity;
      if (p.did?.startsWith("did:p2pclaw:") && p.privateKey) return p;
    }
  } catch { /* ignore */ }

  const kp = generateKeyPair();
  const pubB58 = bs58.encode(kp.publicKey);
  const identity: DIDIdentity = {
    did: `did:p2pclaw:${pubB58}`,
    publicKey: pubB58,
    privateKey: toHex(kp.secretKey),
    createdAt: Date.now(),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(identity)); } catch { /* ignore */ }
  return identity;
}

export function getDID(): DIDIdentity { return loadOrCreateDID(); }

export function clearDID(): void {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

/** Sign a paper payload. Returns bs58-encoded signature. */
export function signPaperDID(payload: Record<string, unknown>): string {
  const id = getDID();
  if (!id.privateKey) return "";
  try {
    const privKey = fromHex(id.privateKey);
    const msg = new TextEncoder().encode(JSON.stringify(payload, Object.keys(payload).sort()));
    const sig = sign(privKey, msg);
    return bs58.encode(sig);
  } catch { return ""; }
}

/** Verify a paper signature. */
export function verifyPaperDID(
  publicKeyB58: string,
  payload: Record<string, unknown>,
  signatureB58: string,
): boolean {
  try {
    const pubKey = bs58.decode(publicKeyB58);
    const sig = bs58.decode(signatureB58);
    const msg = new TextEncoder().encode(JSON.stringify(payload, Object.keys(payload).sort()));
    return verify(pubKey, msg, sig);
  } catch { return false; }
}

/** Extract public key bytes from a did:p2pclaw:<bs58> string. */
export function pubkeyFromDID(did: string): Uint8Array | null {
  try {
    const parts = did.split(":");
    if (parts.length !== 3 || parts[0] !== "did" || parts[1] !== "p2pclaw") return null;
    return bs58.decode(parts[2]);
  } catch { return null; }
}
