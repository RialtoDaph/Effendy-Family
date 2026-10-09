import crypto from "node:crypto";
// @ts-expect-error no types; the reference implementation used by the web-push library
import ece from "http_ece";
import { describe, expect, it } from "vitest";
import { encryptPayload, generateVapidKeys, unb64url, vapidHeader } from "./webpush";

const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");

describe("Web Push", () => {
  it("encrypts so the phone can read it (checked with the reference decoder)", async () => {
    const phone = crypto.createECDH("prime256v1");
    phone.generateKeys();
    const auth = crypto.randomBytes(16);
    const sub = { endpoint: "https://web.push.apple.com/x", p256dh: b64u(phone.getPublicKey()), auth: b64u(auth) };
    const msg = JSON.stringify({ title: "Rent goes out tomorrow", body: "€1,335 · Tue 13 Oct" });
    const body = await encryptPayload(sub, msg);
    const out = ece.decrypt(Buffer.from(body), { version: "aes128gcm", privateKey: phone, authSecret: auth });
    expect(out.toString()).toBe(msg);
  });

  it("signs a VAPID token for the push service", async () => {
    const keys = await generateVapidKeys();
    expect(unb64url(keys.publicKey)).toHaveLength(65);
    const h = await vapidHeader("https://fcm.googleapis.com/fcm/send/abc", keys, "https://effendyfamily.vercel.app");
    const [, t, k] = h.match(/^vapid t=([^,]+), k=(.+)$/)!;
    const [head, claims, sig] = t.split(".");
    const pub = await crypto.webcrypto.subtle.importKey("raw", unb64url(k), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, unb64url(sig), new TextEncoder().encode(`${head}.${claims}`));
    expect(ok).toBe(true);
    expect(JSON.parse(Buffer.from(claims, "base64url").toString()).aud).toBe("https://fcm.googleapis.com");
  });
});
