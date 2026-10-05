import { App } from '@modelcontextprotocol/ext-apps';
const app = new App({ name: 'workflow-card', version: '1.0.0' });
let identity, timer, connected = false, busy = false, started = false, finished = false;
const card = document.getElementById('card');
const status = document.getElementById('status');
const link = document.getElementById('run');
function render(watch) {
  card.hidden = false;
  status.dataset.state = watch.state;
  status.textContent = { running: 'Running Workflow', waiting: 'Waiting for run',
    success: 'Workflow succeeded', failure: 'Workflow failed', cancelled: 'Workflow cancelled', skipped: 'Workflow skipped' }[watch.state];
  link.textContent = `${watch.repository} · ${watch.sha.slice(0, 7)}`;
  link.href = watch.runUrl ?? watch.commitUrl;
  finished = !['waiting', 'running'].includes(watch.state);
}
function schedule() {
  clearTimeout(timer);
  if (connected && !finished && !document.hidden) timer = setTimeout(refresh, 60000);
}
async function refresh() {
  if (!identity || !connected || busy) return;
  started = true; busy = true; clearTimeout(timer);
  try {
    const result = await app.callServerTool({ name: 'get_workflow_status', arguments: identity }, { timeout: 15000 });
    if (result.isError || !result.structuredContent?.watch) throw new Error('Unavailable');
    render(result.structuredContent.watch);
  } catch { card.hidden = false; status.dataset.state = 'unavailable'; status.textContent = 'Status unavailable'; }
  finally { busy = false; schedule(); }
}
app.ontoolresult = result => {
  const watch = result.structuredContent?.watch;
  if (!watch || identity) return;
  identity = { sha: watch.sha, workflow: watch.workflow };
  // Replay may be stale. First read current status, then reveal the card.
  if (connected && !document.hidden) void refresh();
};
link.addEventListener('click', event => {
  event.preventDefault(); void app.openLink({ url: link.href });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else if (!started || !finished) void refresh();
});
window.addEventListener('pagehide', () => clearTimeout(timer));
void app.connect().then(() => { connected = true; if (!document.hidden) void refresh(); });
