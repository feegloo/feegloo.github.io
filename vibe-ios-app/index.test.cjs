const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/index.js', 'utf8');
function setup(responses = []) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, disabled: false, textContent: '', value: '', validity: {valid: true},
      classList: {add() {}, remove() {}, toggle() {}},
      querySelector: () => element('submit'), removeAttribute() {}, reset() {},
    });
    return elements.get(id);
  };
  const storage = () => { const data = new Map(); return {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)}; };
  const location = {search: '?invitation=1234567890123456', hash: '', pathname: '/vibe-ios-app/', assign(url) { this.assigned = url; }};
  const calls = [];
  const context = {
    document: {getElementById: element, querySelector: element},
    location, window: {location, clearInterval() {}, setInterval() {return 1;}},
    localStorage: storage(), sessionStorage: storage(),
    history: {replaceState() {}}, URLSearchParams, AbortSignal,
    crypto: require('node:crypto').webcrypto,
    clearTimeout() {}, setTimeout() {return 1;},
    fetch: async (url, options) => {
      calls.push({url, options});
      const next = responses.shift();
      if (next instanceof Error) throw next;
      if (!next) throw new Error('No mocked response');
      return {ok: next.code ? next.code < 400 : true, status: next.code || 200, json: async () => next.body};
    },
  };
  vm.createContext(context);
  vm.runInContext(source.replace('  initialize();', `  globalThis.api = {
    showResult, pollInvitationStatus, restoreInvitationState, startGitHubLogin,
    setRequest() { currentRequestId = "8fcf5d2d-5281-40e5-8fde-b1cb845331d6"; currentRequestKey = "a".repeat(64); },
    get requestId() { return currentRequestId; }
  };`), context);
  context.api.setRequest();
  return {context, element, calls};
}
const failed = {status: 'pr_created', creationOutcome: 'failed', creationFailureSource: 'app_store', githubConnected: false};
test('Apple failure displays outcome even when optional session linking fails', async () => {
  const {context, element} = setup([{body: failed}, new Error('offline')]);
  context.localStorage.setItem('vibe-github-session', 'session');
  await context.api.pollInvitationStatus();
  assert.equal(element('app-result').hidden, false);
  assert.equal(element('result-title').textContent, 'Your repository is ready');
  assert.match(element('invitation-error').textContent, /App Store Connect/);
  assert.equal(element('github-login').hidden, false);
});
test('OAuth return while Copilot works resumes the creating form', async () => {
  const {context, element} = setup([{body: {status: 'issue_created', creationOutcome: null}}]);
  element('app-result').hidden = false;
  element('result-message').textContent = 'Connecting your GitHub account...';
  await context.api.pollInvitationStatus();
  assert.equal(element('app-result').hidden, true);
  assert.equal(element('create-ios-app-form').hidden, false);
  assert.match(element('submit').textContent, /Creating app/);
});
test('verified owner with access gets the repository link', async () => {
  const {context, element} = setup([{body: {...failed, githubConnected: true, accessStatus: 'collaborator_present', repositoryUrl: 'https://github.com/feegloo/vibe-ios-app-another-project'}}]);
  await context.api.pollInvitationStatus();
  assert.equal(element('repository-link').hidden, false);
  assert.equal(element('github-login').hidden, true);
  assert.match(element('repository-link').href, /another-project$/);
});
test('expired session offers connection again', async () => {
  const {context, element} = setup([{body: failed}, {body: {githubConnected: false}}]);
  context.localStorage.setItem('vibe-github-session', 'expired');
  await context.api.pollInvitationStatus();
  assert.equal(context.localStorage.getItem('vibe-github-session'), null);
  assert.equal(element('github-login').hidden, false);
});
test('connection button starts OAuth and preserves the failed outcome', async () => {
  const {context} = setup([{body: {url: 'https://github.com/login/oauth/authorize?state=test'}}]);
  context.api.showResult(failed);
  await context.api.startGitHubLogin();
  assert.match(context.location.assigned, /^https:\/\/github.com/);
  assert.equal(JSON.parse(context.sessionStorage.getItem('vibe-app-request')).result.creationFailureSource, 'app_store');
});
test('OAuth network failure exposes a retry instead of an indefinite loader', async () => {
  const {context, element} = setup([new Error('timeout'), new Error('offline')]);
  context.location.hash = '#login_ticket=ticket';
  context.sessionStorage.setItem('vibe-login-browser-key', 'key');
  context.sessionStorage.setItem('vibe-app-request', JSON.stringify({id: context.api.requestId, key: 'a'.repeat(64), invitation: '1234567890123456', result: failed}));
  await context.api.restoreInvitationState();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(element('github-login').hidden, false);
  assert.equal(element('github-login').disabled, false);
  assert.equal(element('result-title').textContent, 'Your repository is ready');
  assert.doesNotMatch(element('result-message').textContent, /Connecting/);
});


test('invitation failure explains automatic retry and recovers on the next poll', async () => {
  const base = {status: 'finished', creationOutcome: 'success', githubConnected: true, repositoryUrl: 'https://github.com/feegloo/example'};
  const {context, element, calls} = setup([
    {body: {...base, accessStatus: 'pending', accessState: 'failed'}},
    {body: {...base, accessStatus: 'repository_invited', accessState: 'finished'}},
  ]);
  await context.api.pollInvitationStatus();
  assert.match(element('result-message').textContent, /retry automatically every few seconds/);
  assert.equal(element('repository-link').hidden, true);
  assert.equal(element('github-login').hidden, true);
  await context.api.pollInvitationStatus();
  assert.match(element('result-message').textContent, /invitation has been sent/);
  assert.equal(element('repository-link').hidden, false);
  assert.equal(calls.length, 2);
});
