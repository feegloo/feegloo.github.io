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
