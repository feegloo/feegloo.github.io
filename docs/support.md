# App support

Public URL: https://aleksanderfigiel.pl/ios-breathing-support

A responsive English form for email and message. The app name is fixed to HRV Breathing & Meditation in the submission payload. No sign-in is required.
The page posts directly to the Supabase Data API using a public publishable key.
No service-role key is exposed.

## Data

Project: `vibe-ios-app` (`gwfdnwlhonszocjizrnl`).
Table: `public.support_requests`. Fields: id, created_at, app, email, message, status.
Read and manage requests using the Supabase Table Editor.
Status can be new, in_progress or resolved. Sending the form does not send an email notification.

RLS permits anonymous inserts only. Column grants restrict public inserts to app,
email and message. Public select, update and delete are revoked.
Database constraints validate field lengths and email format. A unique index limits
submissions to one request per email per UTC calendar minute.
The page also blocks concurrent submissions and contains a honeypot.
These are basic abuse controls, not a CAPTCHA or an IP-based rate limit.

Schema source: [support-schema.sql](support-schema.sql). It was applied directly to
the project; it is intended for fresh installations, not repeated execution.

## Local preview

From the repository root, run `python3 -m http.server 8000`, then open
http://localhost:8000/ios-breathing-support/. Submission uses the live Supabase project.
The repository's GitHub Pages workflow publishes changes on main.

## Privacy

The form stores only the submitted app name, email and message plus server-generated
ID, timestamp and status. It has no analytics scripts. The page explains that
submitted information is used to handle the support request.
