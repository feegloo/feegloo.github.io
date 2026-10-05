# Books / ISBN test

Paths: `books.html`, `books.css`, `books.js`, `books-format.js`.

Open `/books.html` and enter the existing dedicated test token. The form connects directly to `https://books-production-4367.up.railway.app` using `x-books-key`.

- ISBN mode posts `{ "isbn": "9788396775801" }` to `/isbn` and displays title, author and the decoded original cover. `cover` contains raw raster-image base64 or null. No image request is made by the client.
- HTML mode posts `{ "url": "https://example.com/" }` to `/page` and retains rendered HTML, response status and diagnostic display.
- Healthcheck reads `/health` on the same books hostname and reports service availability.

The backend is Node-only. No Python switch remains. HTML is rendered as text, never executed. Copy/download uses the displayed response. The test token stays in sessionStorage; URL fragments are consumed and cleared. No token is committed in the website files.

Backend documentation: `feegloo/vibe-ios-app/docs/books-service.md`. The previous test-page filenames and old hostname are replaced by the books names.
