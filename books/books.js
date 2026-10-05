import { formatHTML, renderHTML } from './books-format.js';

const ENDPOINT = 'https://books-production-4367.up.railway.app';
const $ = id => document.getElementById(id);
const mode = () => document.querySelector('input[name=mode]:checked').value;
function coverSource(value) {
  if (typeof value !== 'string' || value.length > 4 * 1024 * 1024) return null;
  const mime = value.startsWith('iVBORw0KGgo') ? 'image/png' : value.startsWith('/9j/') ? 'image/jpeg'
    : value.startsWith('R0lGOD') ? 'image/gif' : value.startsWith('UklGR') ? 'image/webp' : null;
  return mime ? `data:${mime};base64,${value}` : null;
}
for (const input of document.querySelectorAll('input[name=mode]')) input.addEventListener('change', () => {
  const isbn = mode() === 'isbn';
  $('url').type = isbn ? 'text' : 'url';
  $('url').inputMode = isbn ? 'numeric' : 'url';
  $('url').maxLength = isbn ? 13 : 2048;
  $('url').value = isbn ? '9788396775801' : 'https://example.com/';
  $('url').placeholder = isbn ? '13 cyfr ISBN' : 'https://example.com/';
  $('input-label').textContent = isbn ? 'ISBN-13' : 'Adres strony';
  $('output-label').textContent = isbn ? 'JSON' : 'HTML';
});
$('health').addEventListener('click', async () => {
  $('health').disabled = true;
  try {
    const response = await fetch(`${ENDPOINT}/health`, { signal: AbortSignal.timeout(20000) });
    const health = await response.json();
    if (!response.ok || !health.ok) throw new Error(`HTTP ${response.status}`);
    $('health-status').textContent = `Books: HTTP ${response.status} - OK`;
  } catch (error) { $('health-status').textContent = `Healthcheck: ${error.message}`; }
  finally { $('health').disabled = false; }
});
let rawHTML = '';
let displayedHTML = '';
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has('token')) {
  sessionStorage.setItem('books-test-token', fragment.get('token'));
  history.replaceState(null, '', location.pathname + location.search);
}
$('token').value = sessionStorage.getItem('books-test-token') ?? '';
if (!$('token').value) $('access').open = true;

function showHTML() {
  displayedHTML = mode() === 'page' && $('formatted').checked ? formatHTML(rawHTML) : rawHTML;
  renderHTML($('html'), displayedHTML);
}
function showDiagnostics(data, endpointStatus, clientDurationMs) {
  const history = data.attemptHistory ?? [];
  $('diagnostics').hidden = false;
  $('diagnostic-summary').textContent = `Silnik: ${data.engine ?? 'node'} · endpoint HTTP: ${endpointStatus} · klient: ${(clientDurationMs / 1000).toFixed(2)} s · kontener: ${data.durationMs == null ? 'brak danych' : (data.durationMs / 1000).toFixed(2) + ' s'} · próby: ${history.length} · proxy: ${data.configuredProxyCount ?? 'brak danych'} · request ID: ${data.requestId ?? 'brak'}`;
  $('attempt-rows').replaceChildren();
  history.forEach((attempt, index) => {
    const row = document.createElement('tr');
    const failure = attempt.diagnostic;
    const outcome = attempt.httpStatus != null ? `HTTP: ${attempt.httpStatus} ${attempt.httpStatusText ?? ''}${attempt.responseAnalysis?.challengeDetected ? ' · challenge' : ''}` : `${failure?.code ?? attempt.error ?? 'Brak odpowiedzi HTTP'}${failure?.stage ? ' · ' + failure.stage : ''}`;
    const next = index < history.length - 1 ? `Kolejna próba: ${attempt.retryReason ?? 'brak danych'}` : data.stopReason === 'job_budget_exhausted' ? 'Koniec: limit czasu; pokazano ostatnią odpowiedź' : attempt.error ? 'Koniec: błąd przeglądarki / połączenia' : [403, 429].includes(attempt.httpStatus) ? 'Koniec: brak kolejnej próby' : 'Koniec';
    for (const value of [attempt.index ?? index + 1, attempt.route, outcome, attempt.durationMs == null ? 'brak danych' : `${(attempt.durationMs / 1000).toFixed(3)} s`, next]) {
      const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
    }
    $('attempt-rows').append(row);
  });
  const diagnostics = { requestId: data.requestId, engine: data.engine, endpointStatus, clientDurationMs,
    durationMs: data.durationMs, configuredProxyCount: data.configuredProxyCount, maxProxyAttempts: data.maxProxyAttempts,
    attempts: data.attempts, route: data.route, httpStatus: data.httpStatus, error: data.error,
    stopReason: data.stopReason, readiness: data.readiness, responseAnalysis: data.responseAnalysis, sessionReused: data.sessionReused, cookieCount: data.cookieCount, requestHeaders: data.requestHeaders, attemptHistory: history };
  $('diagnostic-json').textContent = JSON.stringify(diagnostics, null, 2);
}
$('formatted').addEventListener('change', showHTML);
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  const token = $('token').value.trim();
  if (!token) { $('access').open = true; $('token').focus(); $('message').textContent = 'Wklej token testowy.'; return; }
  sessionStorage.setItem('books-test-token', token);
  $('send').disabled = true;
  document.querySelectorAll('input[name=mode]').forEach(input => input.disabled = true);
  $('message').className = '';
  $('message').textContent = 'Ładowanie strony… Pierwsze wywołanie może wybudzać kontener.';
  $('result').hidden = true;
  $('diagnostics').hidden = true;
  const clientStarted = performance.now();
  try {
    const selectedMode = mode();
    const value = $('url').value.trim();
    const response = await fetch(`${ENDPOINT}/${selectedMode}`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-books-key': token },
      body: JSON.stringify(selectedMode === 'isbn' ? { isbn: value } : { url: value }), signal: AbortSignal.timeout(90000) });
    const data = await response.json();
    showDiagnostics(data, response.status, Math.round(performance.now() - clientStarted));
    if (!response.ok) {
      if (data.error === 'cooldown') throw new Error(`Strona wymaga przerwy. Spróbuj ponownie za ${data.retryAfterSeconds} s.`);
      throw new Error(data.error ?? `Błąd endpointu HTTP: ${response.status}`);
    }
    if (selectedMode === 'isbn') {
      $('book-result').hidden = false;
      $('book-title').textContent = data.title;
      $('book-author').textContent = data.author;
      const cover = coverSource(data.cover);
      $('book-cover').hidden = !cover;
      if (cover) $('book-cover').src = cover; else $('book-cover').removeAttribute('src');
      rawHTML = JSON.stringify(data, null, 2);
      $('status').textContent = `HTTP: ${response.status}`;
      $('status').className = 'success';
      $('duration').textContent = `${((performance.now() - clientStarted) / 1000).toFixed(2)} s`;
      $('final-url').textContent = `${ENDPOINT}/isbn`;
      for (const id of ['attempts', 'readiness', 'headers']) $(id).textContent = '';
      $('warning').hidden = true;
      $('diagnostics').hidden = true;
      showHTML(); $('result').hidden = false;
      $('message').textContent = 'Książka pobrana.';
      return;
    }
    $('book-result').hidden = true;
    rawHTML = data.html ?? '';
    $('status').textContent = `HTTP: ${data.httpStatus}${data.httpStatusText ? ' ' + data.httpStatusText : ''}`;
    $('status').className = data.httpStatus >= 400 ? 'failure' : 'success';
    $('duration').textContent = `${(data.durationMs / 1000).toFixed(2)} s · ${data.engine ?? 'node'} · ${data.browser}`;
    $('final-url').textContent = data.finalUrl;
    $('attempts').textContent = `Próby: ${data.attempts ?? 1} · ${data.route ?? 'DIRECT'}`;
    $('readiness').textContent = data.htmlSource === 'http_response' ? 'Surowa odpowiedź HTTP · bez renderowania i pobierania zasobów strony' : Object.entries(data.readiness ?? {}).map(([key,value]) => `${key}: ${value ? 'OK' : 'limit czasu'}`).join(' · ');
    $('headers').textContent = Object.entries(data.headers ?? {}).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => `${key}: ${value}`).join('\n');
    $('warning').hidden = !data.truncated;
    $('warning').textContent = 'HTML przekroczył limit 2 MiB. Pokazano początek odpowiedzi.';
    showHTML(); $('result').hidden = false;
    $('message').textContent = 'Odpowiedź pobrana.';
  } catch (error) {
    $('message').className = 'error';
    const messages = { unauthorized: 'Nieprawidłowy token testowy.', invalid_or_blocked_url: 'Nieprawidłowy URL lub niedozwolony adres.',
      busy: 'Kontener obsługuje inny request. Spróbuj ponownie za chwilę.', navigation_failed: 'Przeglądarka nie załadowała strony.',
      books_unavailable: 'Kontener jest niedostępny lub przekroczył limit czasu.', invalid_isbn: 'Wpisz prawidłowy ISBN-13.', book_not_found: 'Book not found.', book_cannot_be_loaded: 'Book cannot be loaded.' };
    $('message').textContent = messages[error.message] ?? `Nie udało się pobrać strony: ${error.message}`;
  } finally { $('send').disabled = false; document.querySelectorAll('input[name=mode]').forEach(input => input.disabled = false); }
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(displayedHTML); $('message').textContent = 'Odpowiedź skopiowana.'; }
  catch { $('message').textContent = 'Nie udało się skopiować. Możesz pobrać plik TXT.'; }
});
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([displayedHTML], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'books-response.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

