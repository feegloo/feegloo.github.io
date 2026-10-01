# GitHub access after app creation

Paths: `vibe-ios-app/index.js`, `vibe-ios-app/index.html`, `vibe-ios-app/index.test.cjs`.

The form email is used for Apple/TestFlight. Repository access belongs to the account
verified by GitHub OAuth, not an email or username entered into the form.
The backend binds that identity to the request; an already linked request cannot be
reassigned to another user.

| State | Result |
| --- | --- |
| Valid site session | Link the account automatically after creation and show the repository link. Stay on the result screen until clicked. |
| Missing or expired site session | Connect GitHub account starts OAuth. GitHub requests sign-in when needed. |
| Owner or existing collaborator | Open repository is a direct one-click link. After clicking Connect GitHub account, redirect in the same tab once the backend confirms `collaborator_present`. |
| Invitation pending or delayed | Stay on the result screen and poll; the backend retries sending the invitation. |
| Invitation sent | Show Accept GitHub invitation linking to the repository's `/invitations` page. Accept using the connected GitHub account. |
| Login or network error | Keep a retry action; never redirect based only on a repository URL. |

OAuth returns to the saved request, exchanges the browser-bound ticket and then fetches
the access status. A request-bound navigation intent is saved only when the user clicks
Connect GitHub account and survives OAuth. Confirmed access then redirects once per
request in the current page. Background session linking and status polling never
navigate without that click.
The ordinary repository link remains available as a fallback. A pending invitation is
not treated as accepted access.

```mermaid
flowchart TD
  A["Creation outcome"] --> S{"Valid site session?"}
  S -->|Yes| L["Link verified GitHub account"]
  S -->|No| O["Connect account and complete OAuth"]
  O --> L
  L --> C{"Access status"}
  C -->|collaborator_present| N{"Clicked Connect GitHub account?"}
  N -->|Yes| R["Redirect to repository"]
  N -->|No| B["Show Open repository link"]
  C -->|pending| P["Poll while invitation worker retries"]
  P --> C
  C -->|repository_invited| I["Accept GitHub invitation"]
```

Tests: `node --test vibe-ios-app/index.test.cjs`.
Manual verification: result screen stays visible before clicking; owner with and without a site session; another GitHub account
accepting its invitation, expired session, cancelled OAuth and a delayed invitation.
