const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {webcrypto} = require('node:crypto');
const script = fs.readFileSync(require('node:path').join(__dirname, '../vibe-ios-app/index.js'), 'utf8');
function setup(status, connected = false, outcome = null) {
  const nodes = new Map();
  const element = key => {
    if (!nodes.has(key)) nodes.set(key, {value:'',checked:false,validity:{valid:true},hidden:false,disabled:false,type:'text',textContent:'',listeners:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},reset(){},setAttribute(){},focus(){},addEventListener(name, fn){this.listeners[name]=fn;},querySelector(){return element('submit');}});
    return nodes.get(key);
  };
  const storage = () => {const map = new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
  const localStorage=storage(), sessionStorage=storage(); localStorage.setItem('vibe-github-session','stale-or-valid');
  let timer, linked=false; const calls=[];
  const result = () => ({requestId:'test-request',status,githubConnected:linked,creationOutcome:outcome,repositoryUrl:outcome?'https://github.com/feegloo/example':null,accessStatus:linked?'repository_invited':null});
  const fetch=async (url, options={}) => {calls.push({url,...options}); if(url.endsWith('github-auth')) {linked=connected;return {ok:true,json:async()=>({githubConnected:connected})};} return {ok:true,json:async()=>result()};};
  const context = {document:{getElementById:element,querySelector:element},localStorage,sessionStorage,crypto:webcrypto,URLSearchParams,URL,FormData,fetch,createDrawingEditor:()=>({open(){}}),location:{search:'?invitation=082b',hash:''},setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){}};
  context.window=context;vm.runInNewContext(script,context);
  element('email').value='test@example.com';element('app-name').value='Test app';element('initial-prompt').value='Make it';element('agreement').checked=true;
  return {element, calls, localStorage, submit:()=>element('create-ios-app-form').listeners.submit({preventDefault(){}}), poll:()=>timer()};
}
for(const status of ['missing_invitation','invalid_invitation','invitation_limit']) test(status+' bypasses GitHub completely',async()=>{
  const t=setup(status);await t.submit();assert.equal(t.calls.length,1);assert.equal(t.calls[0].headers.Authorization,undefined);assert.equal(t.element('result-title').textContent,'Request saved');assert.equal(t.element('github-login').hidden,true);assert.equal(t.element('invitation-error').textContent,'');
});
for(const connected of [false,true]) test('success with '+(connected?'valid':'expired')+' session',async()=>{
  const t=setup('finished',connected,'success');await t.submit();assert.equal(t.calls.length,1);await t.poll();assert.equal(t.element('github-login').hidden,connected);assert.equal(t.element('repository-link').hidden,!connected);assert.equal(t.element('result-title').textContent,'App successfully created!');assert.equal(t.element('invitation-error').textContent,'');if(!connected)assert.equal(t.localStorage.getItem('vibe-github-session'),null);assert.ok(t.calls.filter(c=>c.url.includes('create-app')).every(c=>!c.headers.Authorization));
});
test('running Copilot does not check identity',async()=>{const t=setup('issue_created');await t.submit();await t.poll();assert.ok(t.calls.every(c=>!c.url.endsWith('github-auth')));});
test('failed Copilot permits access without claiming success',async()=>{const t=setup('repository_created',true,'failed');await t.submit();await t.poll();assert.equal(t.element('repository-link').hidden,false);assert.equal(t.element('apple-email-message').hidden,true);assert.match(t.element('resultMessage')?.textContent||t.element('result-message').textContent,/Copilot could not complete/);assert.equal(t.element('result-title').textContent,'Your repository is ready');});
