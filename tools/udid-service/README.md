# UDID Profile Service

Frontend: https://aleksanderfigiel.pl/udid/
Supabase project: gwfdnwlhonszocjizrnl (udid-service).

The website downloads an unsigned Profile Service configuration that requests only UDID. iOS posts its CMS-signed response to the Edge Function, which validates integrity and a 30-minute HMAC challenge, then redirects with 303 to the fixed frontend URL. The result is in the URL fragment, immediately removed by JavaScript. Only random session state is stored in localStorage. No application database, analytics, or device-data logging is used. Hosting providers may retain connection metadata. Edge execution is not restricted to the database's region.

## Security boundaries

- 64 KiB request limit, restricted MIME types, strict flat plist parsing, no XML entity expansion.
- CMS signature integrity is checked against the embedded signer certificate. Apple trust-chain attestation is NOT performed. This is a convenience display tool, not proof of ownership, authentication, or automatic device registration.
- A public profile route issues expiring HMAC challenges, bound to random browser state. This prevents unsolicited results in a user's browser; it does not restrict who can use the public service. Challenges are replayable until expiry, with no persistent mutation.
- HMAC key is derived with HKDF from UDID_CHALLENGE_SECRET if configured, otherwise a server-only Supabase secret. No secret belongs in this repository. Rotating the secret invalidates outstanding downloads.
- The callback never accepts a user-selected redirect URL. Errors omit submitted identifiers and tokens.
- No distributed rate limit is implemented. Supabase platform quotas apply. For heavy public exposure, add a gateway rate limit; do not treat the HMAC challenge as bot protection.
- The downloaded profile is currently UNSIGNED, disclosed on the webpage. PayloadOrganization is not a cryptographic signature. Trusted signing requires a suitable certificate and private key; GitHub Pages HTTPS does not expose its private key. Never add these keys to this public repository. The desired signed-by label is not implemented yet.

## Build and deploy

This source directory is `tools/udid-service` in the website repository; frontend files are in `/udid`.

```
npm ci
npm run build
npm test
supabase functions deploy udid-service --project-ref gwfdnwlhonszocjizrnl --no-verify-jwt
```

The function uses its own challenge validation because iOS does not supply a Supabase JWT. Bundling avoids a CommonJS dependency compatibility issue in the hosted runtime. Commit source and lockfile; build handler.bundle.js before deploying. Do not publish node_modules or secrets. Backend changes require a function deployment; Pages only publishes the frontend.

Local tests use synthetic CMS responses, including tampering, expiry, oversize bodies, invalid XML, and frontend state mismatch. Hosted profile GET and signed POST were checked successfully (200 then 303). These tests do not replace installation on a real iPhone: open Safari, download, install through Settings, confirm return, copy UDID, then clear result. Profile download tokens expire after 30 minutes. No device passcode is collected by the website.

## Diagnostics (diagnostics-v1)

Open Supabase dashboard > Edge Functions > udid-service > Logs. Filter for `udid` or `diagnostics-v1`, use the timestamp of the installation attempt. Each request has request_started and request_finished sharing a random request_id. Responses also include X-UDID-Request-ID and X-UDID-Debug-Revision. Application logs contain only route/method categories, stage, HTTP status, body byte count and elapsed milliseconds. No URL, headers, raw error messages, body, UDID, challenge, state or certificate data are logged. Platform Invocations metadata is separate and may include sensitive headers: share only the custom JSON log lines.

- profile_issued / 200: profile generated. Does not prove device installation.
- receive + request_started: POST reached the function.
- content_type / 415: unsupported MIME type.
- body_read / 413: body exceeds limit.
- cms_parse / 400: cannot decode signed envelope.
- cms_signature / 400: signature validation failed or unsupported algorithm.
- plist_decode or plist_parse / 400: signed payload cannot be decoded/parsed.
- challenge_verify / 400: token absent, expired or invalid.
- udid_format / 400: missing or malformed identifier.
- redirect_issued / 303: callback completed; next investigate iOS redirect handling / frontend session.

No POST logs: inspect Invocations for gateway rejection first; if absent there too, investigate the device/profile/network. A start without finish suggests a runtime interruption. Absence of logs alone is not proof that no request was sent (filters/retention/platform limits also apply).
