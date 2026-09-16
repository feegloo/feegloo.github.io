import { createHandler } from "./handler.bundle.js";

const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const secret = Deno.env.get("UDID_CHALLENGE_SECRET") || secrets.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!secret) throw new Error("Server configuration missing");
const privateKeyBase64 = Deno.env.get("UDID_SIGNING_KEY_BASE64");
const certificateBase64 = Deno.env.get("UDID_SIGNING_CERT_BASE64");
if (!privateKeyBase64 || !certificateBase64) throw new Error("Profile signing configuration missing");
Deno.serve(createHandler(secret, { privateKeyBase64, certificateBase64 }));
