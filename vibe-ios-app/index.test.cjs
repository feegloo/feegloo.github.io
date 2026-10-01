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
  assert.equal(context.location.assigned, undefined);
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
  assert.equal(element('repository-link').href, base.repositoryUrl + '/invitations');
  assert.equal(element('repository-link').textContent, 'Accept GitHub invitation');
  assert.equal(context.location.assigned, undefined);
  assert.equal(calls.length, 2);
});

const repositoryUrl = 'https://github.com/feegloo/vibe-ios-app-example';
const ready = {status: 'finished', creationOutcome: 'success', githubConnected: true, accessStatus: 'collaborator_present', repositoryUrl};

function saveOAuthRequest(context, result = failed) {
  context.location.hash = '#login_ticket=ticket';
  context.sessionStorage.setItem('vibe-login-browser-key', 'key');
  context.sessionStorage.setItem('vibe-app-request', JSON.stringify({
    id: context.api.requestId, key: 'a'.repeat(64), invitation: '1234567890123456', result, openRepository: true,
  }));
}

test('valid owner session links automatically but stays on the result screen until a click', async () => {
  const {context, element, calls} = setup([
    {body: {...ready, githubConnected: false, accessStatus: null}},
    {body: {githubConnected: true}}, {body: ready},
  ]);
  context.localStorage.setItem('vibe-github-session', 'valid');
  await context.api.pollInvitationStatus();
  assert.equal(context.location.assigned, undefined);
  assert.equal(element('repository-link').hidden, false);
  assert.equal(element('repository-link').href, repositoryUrl);
  assert.equal(JSON.parse(calls[1].options.body).action, 'connect');
  assert.equal(calls.some(call => JSON.parse(call.options?.body || '{}').action === 'start'), false);
});

test('owner without a site session completes OAuth then redirects without another click', async () => {
  const {context, calls} = setup([
    {body: {url: 'https://github.com/login/oauth/authorize?state=test'}},
    {body: {token: 'verified-session'}}, {body: ready},
  ]);
  context.api.showResult({...ready, githubConnected: false, accessStatus: null});
  await context.api.startGitHubLogin();
  assert.match(context.location.assigned, /oauth\/authorize/);
  context.location.hash = '#login_ticket=ticket';
  await context.api.restoreInvitationState();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.location.assigned, repositoryUrl);
  assert.equal(context.localStorage.getItem('vibe-github-session'), 'verified-session');
  assert.deepEqual(calls.filter(c => c.url.endsWith('github-auth')).map(c => JSON.parse(c.options.body).action), ['start', 'exchange']);
});

test('another account returning from OAuth waits for invitation and gets its acceptance link', async () => {
  const {context, element} = setup([
    {body: {token: 'another-account-session'}},
    {body: {...ready, accessStatus: 'pending'}},
    {body: {...ready, accessStatus: 'repository_invited'}},
  ]);
  saveOAuthRequest(context);
  await context.api.restoreInvitationState();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.location.assigned, undefined);
  assert.equal(element('github-login').hidden, true);
  assert.equal(element('repository-link').hidden, true);
  await context.api.pollInvitationStatus();
  assert.equal(element('repository-link').href, repositoryUrl + '/invitations');
  assert.equal(context.location.assigned, undefined);
});

test('another account already collaborating redirects just like the owner', async () => {
  const {context} = setup([{body: {token: 'collaborator-session'}}, {body: ready}]);
  saveOAuthRequest(context);
  await context.api.restoreInvitationState();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.location.assigned, repositoryUrl);
});

test('retry with a valid session avoids repeating OAuth', async () => {
  const {context, calls} = setup([
    {body: {...ready, githubConnected: false, accessStatus: null}},
    {body: {githubConnected: true}}, {body: ready},
  ]);
  context.localStorage.setItem('vibe-github-session', 'valid');
  await context.api.startGitHubLogin();
  assert.equal(context.location.assigned, repositoryUrl);
  assert.equal(calls.length, 3);
});

test('expired session on retry falls back to OAuth', async () => {
  const {context, calls} = setup([
    {body: {...ready, githubConnected: false, accessStatus: null}},
    {body: {githubConnected: false}},
    {body: {url: 'https://github.com/login/oauth/authorize?state=fresh'}},
  ]);
  context.localStorage.setItem('vibe-github-session', 'expired');
  await context.api.startGitHubLogin();
  assert.equal(context.localStorage.getItem('vibe-github-session'), null);
  assert.match(context.location.assigned, /state=fresh/);
  assert.equal(JSON.parse(calls[2].options.body).action, 'start');
});

test('unverified identity never redirects even if the response contains a repository URL', async () => {
  const {context} = setup([{body: {...ready, githubConnected: false}}]);
  await context.api.pollInvitationStatus();
  assert.equal(context.location.assigned, undefined);
});

test('redirect is attempted only once per request and leaves a fallback link', async () => {
  const {context, element} = setup([{body: ready}, {body: ready}]);
  context.localStorage.setItem('vibe-github-session', 'valid');
  let redirects = 0;
  context.location.assign = () => { redirects++; };
  await context.api.startGitHubLogin();
  await context.api.pollInvitationStatus();
  assert.equal(redirects, 1);
  assert.equal(element('repository-link').href, repositoryUrl);
  assert.equal(element('repository-link').textContent, 'Open repository');
});

test('cancelled OAuth never redirects', async () => {
  const {context, element, calls} = setup();
  saveOAuthRequest(context);
  context.location.hash = '#login_error=cancelled';
  await context.api.restoreInvitationState();
  assert.equal(context.location.assigned, undefined);
  assert.equal(element('create-ios-app-form').hidden, false);
  assert.equal(calls.length, 0);
});

test('repeated background status checks never navigate before the user clicks', async () => {
  const {context, element} = setup([{body: ready}, {body: ready}]);
  await context.api.pollInvitationStatus();
  await context.api.pollInvitationStatus();
  assert.equal(context.location.assigned, undefined);
  assert.equal(element('app-result').hidden, false);
  assert.equal(element('repository-link').href, repositoryUrl);
});

test('OAuth return without a saved click intent shows the link instead of redirecting', async () => {
  const {context, element} = setup([{body: {token: 'verified-session'}}, {body: ready}]);
  saveOAuthRequest(context);
  const saved = JSON.parse(context.sessionStorage.getItem('vibe-app-request'));
  delete saved.openRepository;
  context.sessionStorage.setItem('vibe-app-request', JSON.stringify(saved));
  await context.api.restoreInvitationState();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.location.assigned, undefined);
  assert.equal(element('repository-link').hidden, false);
});

test('one click survives delayed access confirmation', async () => {
  const {context} = setup([{body: {...ready, accessStatus: 'pending'}}, {body: ready}]);
  context.localStorage.setItem('vibe-github-session', 'valid');
  await context.api.startGitHubLogin();
  assert.equal(context.location.assigned, undefined);
  await context.api.pollInvitationStatus();
  assert.equal(context.location.assigned, repositoryUrl);
});

test('failed click clears navigation intent before subsequent background recovery', async () => {
  const {context} = setup([new Error('offline'), {body: ready}]);
  context.localStorage.setItem('vibe-github-session', 'valid');
  await context.api.startGitHubLogin();
  await context.api.pollInvitationStatus();
  assert.equal(context.location.assigned, undefined);
});
