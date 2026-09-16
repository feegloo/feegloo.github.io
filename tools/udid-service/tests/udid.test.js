import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler, readDevicePlist } from "../supabase/functions/udid-service/handler.js";

const base = "https://gwfdnwlhonszocjizrnl.supabase.co/functions/v1/udid-service";
const state = "a".repeat(64);
const secret = "test-only-secret-not-used-in-deployment";
const udid = "00000000-0000000000000001";
let clock = 1800000000;
const events = [];
const handler = createHandler(secret, () => clock, event => events.push(event));
function request(body, extra = {}) {
  return new Request(`${base}/receive`, { method: "POST", headers: { "content-type": "application/pkcs7-signature", ...extra }, body });
}

test("signed callback round trip, errors and challenge expiry", async () => {
  const folder = mkdtempSync(join(tmpdir(), "udid-test-"));
  try {
    const profile = await handler(new Request(`${base}/profile?state=${state}`));
    assert.equal(profile.status, 200);
    const xml = await profile.text();
    assert.match(xml, /<array><string>UDID<\/string><\/array>/);
    assert.doesNotMatch(xml, /IMEI|SERIAL|PRODUCT|VERSION/);
    const challenge = /<key>Challenge<\/key><string>([^<]+)<\/string>/.exec(xml)[1];
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(folder,"key.pem"), "-out", join(folder,"cert.pem"), "-days", "1", "-subj", "/CN=Test fixture"], { stdio: "ignore" });
    function sign(token) {
      writeFileSync(join(folder,"body.plist"), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>UDID</key><string>${udid}</string><key>CHALLENGE</key><string>${token}</string><key>VERSION</key><string>TEST</string></dict></plist>`);
      execFileSync("openssl", ["cms", "-sign", "-binary", "-nodetach", "-in", join(folder,"body.plist"), "-signer", join(folder,"cert.pem"), "-inkey", join(folder,"key.pem"), "-outform", "DER", "-out", join(folder,"body.der")]);
      return readFileSync(join(folder,"body.der"));
    }
    const body = sign(challenge);
    const response = await handler(request(body));
    assert.equal(response.status, 303);
    assert.equal(events.at(-1).stage, 'redirect_issued');
    assert.equal(events.at(-1).request_id, response.headers.get('X-UDID-Request-ID'));
    assert.equal(response.headers.get('X-UDID-Debug-Revision'), 'diagnostics-v1');
    const url = new URL(response.headers.get("location"));
    assert.equal(url.origin, "https://aleksanderfigiel.pl");
    assert.equal(url.search, "");
    assert.equal(new URLSearchParams(url.hash.slice(1)).get("udid"), udid);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const changed = Buffer.from(body); changed[changed.indexOf(udid)] = 49;
    assert.equal((await handler(request(changed))).status, 400);
    const wrong = challenge.slice(0,-2) + (challenge.endsWith("AA") ? "BB" : "AA");
    assert.equal((await handler(request(sign(wrong)))).status, 400);
    assert.equal(events.at(-1).stage, 'challenge_verify');
    clock += 1801;
    assert.equal((await handler(request(body))).status, 400);
    assert.equal((await handler(request(new Uint8Array(65537)))).status, 413);
    assert.equal((await handler(request("plain", { "content-type": "application/json" }))).status, 415);
    assert.equal((await handler(request("not CMS"))).status, 400);
    assert.equal((await handler(new Request(`${base}/profile?state=invalid`))).status, 400);
    assert.equal((await handler(new Request(`${base}/receive`))).status, 405);
    const logged = JSON.stringify(events);
    for (const sensitive of [udid, challenge, state, secret, 'Test fixture']) assert.ok(!logged.includes(sensitive));
    assert.ok(events.some(e => e.stage === 'cms_signature' && e.status === 400));
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("rejects duplicate fields and entity expansion", () => {
  assert.throws(() => readDevicePlist('<plist version="1.0"><dict><key>UDID</key><string>A</string><key>UDID</key><string>B</string></dict></plist>'));
  assert.throws(() => readDevicePlist('<!ENTITY x SYSTEM "file:///etc/passwd"><plist version="1.0"><dict></dict></plist>'));
  assert.throws(() => readDevicePlist('<plist version="1.0"><dict><key>UDID</key><string>&x;</string></dict></plist>'));
});
