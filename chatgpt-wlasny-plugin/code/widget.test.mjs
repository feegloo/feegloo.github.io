import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const order of ['result-first', 'connect-first']) {
  test(`stale running replay stays hidden until current success (${order})`, async () => {
    const elements = { card: { hidden: true }, status: { dataset: {}, textContent: '' },
      run: { addEventListener() {} } };
    let app, connect, respond;
    const connection = new Promise(resolve => { connect = resolve; });
    const response = new Promise(resolve => { respond = resolve; });
    class FakeApp {
      constructor() { app = this; this.calls = []; }
      connect() { return connection; }
      callServerTool(args) { this.calls.push(args); return response; }
    }
    const source = readFileSync(new URL('./widget.js', import.meta.url), 'utf8').replace(/^import .*;\n/, '');
    vm.runInNewContext(source, { App: FakeApp, document: { hidden: false,
      getElementById: id => elements[id], addEventListener() {} },
      window: { addEventListener() {} }, setTimeout() { throw new Error('Success should not poll'); }, clearTimeout() {} });
    const watch = { sha: 'a'.repeat(40), workflow: 'demo.yml', repository: 'example/demo', state: 'running' };
    if (order === 'connect-first') { connect(); await Promise.resolve(); }
    app.ontoolresult({ structuredContent: { watch } });
    connect(); await Promise.resolve();
    assert.equal(elements.card.hidden, true);
    assert.equal(elements.status.textContent, '');
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].arguments.sha, watch.sha);
    respond({ structuredContent: { watch: { ...watch, state: 'success', runUrl: 'https://github.com/example/demo/actions/runs/1' } } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.card.hidden, false);
    assert.equal(elements.status.dataset.state, 'success');
    assert.equal(elements.status.textContent, 'Workflow succeeded');
    app.ontoolresult({ structuredContent: { watch } });
    assert.equal(elements.status.dataset.state, 'success');
  });
}
