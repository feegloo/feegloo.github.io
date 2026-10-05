import { formatHTML, renderHTML } from './scraper-format.js';

const ENDPOINT = 'https://gwfdnwlhonszocjizrnl.supabase.co/functions/v1/scrape-page';
const $ = id => document.getElementById(id);
let rawHTML = '';
let displayedHTML = '';
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has('token')) {
  sessionStorage.setItem('scraper-test-token', fragment.get('token'));
  history.replaceState(null, '', location.pathname + location.search);
}
$('token').value = sessionStorage.getItem('scraper-test-token') ?? '';
if (!$('token').value) $('access').open = true;

function showHTML() {
  displayedHTML = $('formatted').checked ? formatHTML(rawHTML) : rawHTML;
  renderHTML($('html'), displayedHTML);
}
function showDiagnostics(data, endpointStatus, clientDurationMs) {
  const history = data.attemptHistory ?? [];
  $('diagnostics').hidden = false;
  $('diagnostic-summary').textContent = `Silnik: ${data.engine ?? document.querySelector('input[name=engine]:checked').value} · endpoint HTTP: ${endpointStatus} · klient: ${(clientDurationMs / 1000).toFixed(2)} s · kontener: ${data.durationMs == null ? 'brak danych' : (data.durationMs / 1000).toFixed(2) + ' s'} · próby: ${history.length} · proxy: ${data.configuredProxyCount ?? 'brak danych'} · request ID: ${data.requestId ?? 'brak'}`;
  $('attempt-rows').replaceChildren();
  history.forEach((attempt, index) => {
    const row = document.createElement('tr');
    const failure = attempt.diagnostic;
    const outcome = attempt.httpStatus != null ? `HTTP: ${attempt.httpStatus} ${attempt.httpStatusText ?? ''}` : `${failure?.code ?? attempt.error ?? 'Brak odpowiedzi HTTP'}${failure?.stage ? ' · ' + failure.stage : ''}`;
    const next = index < history.length - 1 ? `Kolejna próba: ${attempt.retryReason ?? 'brak danych'}` : attempt.error ? 'Koniec: błąd przeglądarki / połączenia' : attempt.httpStatus === 429 ? 'Koniec: brak kolejnej próby' : 'Koniec';
    for (const value of [attempt.index ?? index + 1, attempt.route, outcome, attempt.durationMs == null ? 'brak danych' : `${(attempt.durationMs / 1000).toFixed(3)} s`, next]) {
      const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
    }
    $('attempt-rows').append(row);
  });
  const diagnostics = { requestId: data.requestId, engine: data.engine, endpointStatus, clientDurationMs,
    durationMs: data.durationMs, configuredProxyCount: data.configuredProxyCount, maxProxyAttempts: data.maxProxyAttempts,
    attempts: data.attempts, route: data.route, httpStatus: data.httpStatus, error: data.error,
    readiness: data.readiness, attemptHistory: history };
  $('diagnostic-json').textContent = JSON.stringify(diagnostics, null, 2);
}
$('formatted').addEventListener('change', showHTML);
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  const token = $('token').value.trim();
  if (!token) { $('access').open = true; $('token').focus(); $('message').textContent = 'Wklej token testowy.'; return; }
  sessionStorage.setItem('scraper-test-token', token);
  $('send').disabled = true;
  document.querySelectorAll('input[name=engine]').forEach(input => input.disabled = true);
  $('message').className = '';
  $('message').textContent = 'Ładowanie strony… Pierwsze wywołanie może wybudzać kontener.';
  $('result').hidden = true;
  $('diagnostics').hidden = true;
  const clientStarted = performance.now();
  try {
    const response = await fetch(ENDPOINT, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-scraper-key': token },
      body: JSON.stringify({ url: $('url').value.trim(), engine: document.querySelector('input[name=engine]:checked').value }), signal: AbortSignal.timeout(90000) });
    const data = await response.json();
    showDiagnostics(data, response.status, Math.round(performance.now() - clientStarted));
    if (!response.ok) {
      if (data.error === 'cooldown') throw new Error(`Strona wymaga przerwy. Spróbuj ponownie za ${data.retryAfterSeconds} s.`);
      throw new Error(data.error ?? `Błąd endpointu HTTP: ${response.status}`);
    }
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
      scraper_unavailable: 'Kontener jest niedostępny lub przekroczył limit czasu.' };
    $('message').textContent = messages[error.message] ?? `Nie udało się pobrać strony: ${error.message}`;
  } finally { $('send').disabled = false; document.querySelectorAll('input[name=engine]').forEach(input => input.disabled = false); }
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(displayedHTML); $('message').textContent = 'HTML skopiowany.'; }
  catch { $('message').textContent = 'Nie udało się skopiować. Możesz pobrać plik TXT.'; }
});
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([displayedHTML], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'scraped-html.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
