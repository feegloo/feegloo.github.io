import { createHandler } from "./handler.bundle.js";

const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const secret = Deno.env.get("UDID_CHALLENGE_SECRET") || secrets.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!secret) throw new Error("Server configuration missing");
Deno.serve(createHandler(secret));
