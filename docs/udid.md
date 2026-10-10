# UDID page

The static page at [aleksanderfigiel.pl/udid/](https://aleksanderfigiel.pl/udid/)
downloads the signed Device UDID profile from the existing Supabase service.
See [service security and deployment](../tools/udid-service/README.md).

The result handler runs on initial load, `hashchange` and `pageshow`.
This covers Safari returning from Settings into the same open document or restoring it
from the back/forward cache, without rerunning the deferred script.
A successful return shows the read-only UDID field and copy button and scrolls to the top.

The callback fragment is cleared before validation. The result must match the locally
stored random session state, be returned within 30 minutes and contain a valid modern
or legacy 40-character UDID. Only random session state is stored, never the UDID.
Repeated lifecycle events after consuming the fragment preserve the displayed result.
Unavailable Clipboard API falls back to selecting the input for native copying.

Run the frontend regression tests without backend dependencies:

```bash
node --test tools/udid-service/tests/frontend.test.js
```

Real-device verification: download and install a fresh profile from Safari, return from
Settings, confirm the result is visible at the top, then copy it. Check an older iPhone
and a current iPhone. Opening a callback in another browser or after session expiry must
show a session error.
