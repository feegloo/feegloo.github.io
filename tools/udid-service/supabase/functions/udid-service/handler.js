import * as asn1js from "asn1js";
import { ContentInfo, SignedData } from "pkijs";

const RESULT = "https://aleksanderfigiel.pl/udid/";
const CALLBACK = "https://gwfdnwlhonszocjizrnl.supabase.co/functions/v1/udid-service/receive";
const encoder = new TextEncoder();
const LIMIT = 64 * 1024;
const TTL = 30 * 60;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const unbase64url = value => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
const reply = (text, status) => new Response(text, { status, headers });

// Domain-separated derivation: the platform secret never leaves the function.
export function createHandler(secret, now = () => Math.floor(Date.now() / 1000), log = event => console.log(JSON.stringify(event))) {
  const key = (async () => {
    if (!secret || secret.length < 32) throw new Error("Missing server secret");
    const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: encoder.encode("udid-service-v1"), info: encoder.encode("profile-challenge") }, material, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]);
  })();
  async function issue(state) {
    const value = `${now() + TTL}.${state}`;
    return `${value}.${base64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key, encoder.encode(value))))}`;
  }
  async function check(token) {
    const match = /^(\d{10})\.([a-f0-9]{64})\.([A-Za-z0-9_-]{43})$/.exec(token);
    if (!match || +match[1] < now() || +match[1] > now() + TTL) throw new Error("Expired challenge");
    if (!await crypto.subtle.verify("HMAC", await key, unbase64url(match[3]), encoder.encode(`${match[1]}.${match[2]}`))) throw new Error("Invalid challenge");
    return match[2];
  }
  return async request => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const pathName = new URL(request.url).pathname;
    const route = pathName.endsWith('/profile') ? 'profile' : pathName.endsWith('/receive') ? 'receive' : 'other';
    const method = ['GET', 'POST', 'OPTIONS', 'HEAD'].includes(request.method) ? request.method : 'other';
    let stage = 'routing', bytesRead = 0;
    const emit = fields => { try { log({ service: 'udid', revision: 'diagnostics-v1', request_id: requestId, route, method, ...fields }); } catch {} };
    emit({ event: 'request_started' });
    const process = async () => {
    try {
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path.endsWith("/profile")) {
        stage = 'profile_state';
        const state = new URL(request.url).searchParams.get("state") || "";
        if (!/^[a-f0-9]{64}$/.test(state)) return reply("Invalid session. Start at aleksanderfigiel.pl/udid/", 400);
        stage = 'profile_challenge';
        const token = await issue(state);
        const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>PayloadContent</key><dict>
<key>URL</key><string>${CALLBACK}</string>
<key>DeviceAttributes</key><array><string>UDID</string></array>
<key>Challenge</key><string>${token}</string>
</dict>
<key>PayloadOrganization</key><string>aleksanderfigiel.pl</string>
<key>PayloadDisplayName</key><string>Odczyt UDID</string>
<key>PayloadDescription</key><string>UDID for AdHoc app development</string>
<key>PayloadType</key><string>Profile Service</string>
<key>PayloadVersion</key><integer>1</integer>
<key>PayloadIdentifier</key><string>pl.aleksanderfigiel.udid</string>
<key>PayloadUUID</key><string>${crypto.randomUUID()}</string>
</dict></plist>`;
        stage = 'profile_issued';
        return new Response(profile, { headers: { ...headers, "Content-Type": "application/x-apple-aspen-config", "Content-Disposition": 'attachment; filename="udid.mobileconfig"' } });
      }
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { ...headers, Allow: "GET, POST" } });
      if (!path.endsWith("/receive")) return reply("Not found", 404);
      stage = 'content_type';
      const type = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!["application/pkcs7-signature", "application/x-pkcs7-signature", "application/octet-stream"].includes(type)) return reply("Expected signed device response", 415);
      stage = 'body_read';
      if (Number(request.headers.get("content-length")) > LIMIT) return reply("Request too large", 413);
      const reader = request.body?.getReader();
      if (!reader) return reply("Empty body", 400);
      const chunks = []; let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length; bytesRead = total;
        if (total > LIMIT) { await reader.cancel(); return reply("Request too large", 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      stage = 'cms_parse';
      const parsed = asn1js.fromBER(bytes.buffer);
      if (parsed.offset !== total || parsed.offset < 0) throw new Error("Invalid CMS");
      const envelope = new ContentInfo({ schema: parsed.result });
      if (envelope.contentType !== "1.2.840.113549.1.7.2") throw new Error("Expected SignedData");
      const signed = new SignedData({ schema: envelope.content });
      if (signed.signerInfos.length !== 1 || signed.encapContentInfo.eContentType !== "1.2.840.113549.1.7.1" || !signed.encapContentInfo.eContent) throw new Error("Invalid signed content");
      // Integrity check only. Not Apple attestation and never used for login or automatic registration.
      stage = 'cms_signature';
      if (!await signed.verify({ signer: 0, checkChain: false })) throw new Error("Invalid CMS signature");
      stage = 'plist_decode';
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(signed.encapContentInfo.eContent.getValue());
      stage = 'plist_parse';
      const values = readDevicePlist(xml);
      stage = 'challenge_verify';
      const state = await check(values.CHALLENGE || "");
      stage = 'udid_format';
      const udid = (values.UDID || "").toUpperCase();
      if (!/^(?:[A-F0-9]{8}-[A-F0-9]{16}|[A-F0-9]{40})$/.test(udid)) throw new Error("Invalid UDID");
      stage = 'redirect_issued';
      const fragment = new URLSearchParams({ udid, state });
      return new Response(null, { status: 303, headers: { ...headers, Location: `${RESULT}#${fragment}` } });
    } catch {
      // Stage only: library exception messages may contain submitted data.
      return reply("Nie można odczytać UDID. Pobierz nowy profil z aleksanderfigiel.pl/udid/ i spróbuj ponownie.", 400);
    }
    };
    const response = await process();
    response.headers.set('X-UDID-Request-ID', requestId);
    response.headers.set('X-UDID-Debug-Revision', 'diagnostics-v1');
    emit({ event: 'request_finished', stage, status: response.status, bytes_read: bytesRead, duration_ms: Date.now() - started });
    return response;
  };
}

export function readDevicePlist(xml) {
  // This protocol uses a flat string dictionary. No entity expansion or general XML parser.
  if (xml.length > 16384 || /<!ENTITY|<!\[CDATA\[/i.test(xml)) throw new Error("Unsupported XML");
  let remaining = xml.trim().replace(/^<\?xml[^?]*\?>\s*/, "");
  remaining = remaining.replace(/^<!DOCTYPE plist PUBLIC "-\/\/Apple(?: Computer)?\/\/DTD PLIST 1\.0\/\/EN" "https?:\/\/www\.apple\.com\/DTDs\/PropertyList-1\.0\.dtd">\s*/, "");
  const outer = /^<plist version="1\.0">\s*<dict>([\s\S]*)<\/dict>\s*<\/plist>$/.exec(remaining);
  if (!outer) throw new Error("Invalid plist");
  remaining = outer[1].trim();
  const values = Object.create(null);
  while (remaining) {
    const pair = /^<key>([A-Z0-9_]+)<\/key>\s*<string>([^<&]*)<\/string>\s*/.exec(remaining);
    if (!pair || Object.hasOwn(values, pair[1])) throw new Error("Invalid or duplicate field");
    values[pair[1]] = pair[2];
    remaining = remaining.slice(pair[0].length);
  }
  return values;
}
