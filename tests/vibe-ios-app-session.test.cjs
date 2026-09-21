const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {webcrypto} = require('node:crypto');
const script = fs.readFileSync(require('node:path').join(__dirname, '../vibe-ios-app/index.js'), 'utf8');
function setup(status, connected = false, outcome = null, initial = {}) {
  const nodes = new Map();
  const element = key => {
    if (!nodes.has(key)) nodes.set(key, {value:'',checked:false,validity:{valid:true},hidden:false,disabled:false,type:'text',textContent:'',listeners:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},reset(){},setAttribute(){},focus(){},addEventListener(name, fn){this.listeners[name]=fn;},querySelector(){return element('submit');}});
    return nodes.get(key);
  };
  const storage = () => {const map = new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
  const localStorage=storage(), sessionStorage=storage(); localStorage.setItem('vibe-github-session','stale-or-valid');
  if (initial.saved) sessionStorage.setItem('vibe-app-request', JSON.stringify(initial.saved));
  if (initial.draft) localStorage.setItem('vibe-app-draft:082b', JSON.stringify(initial.draft));
  let timer, linked=false; const calls=[];
  const result = () => ({requestId:'test-request',status,githubConnected:linked,creationOutcome:outcome,repositoryUrl:outcome?'https://github.com/feegloo/example':null,accessStatus:linked?(initial.accessStatus ?? 'repository_invited'):null});
  const fetch=async (url, options={}) => {calls.push({url,...options}); if(url.endsWith('github-auth')) {linked=connected;return {ok:true,json:async()=>({githubConnected:connected})};} return {ok:true,json:async()=>result()};};
  const context = {history:{replaceState(){}},document:{getElementById:element,querySelector:element},localStorage,sessionStorage,crypto:webcrypto,URLSearchParams,URL,FormData,fetch,createDrawingEditor:()=>({open(){}}),location:{search:'?invitation=082b',hash:initial.hash || ''},setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){}};
  context.window=context;vm.runInNewContext(script,context);
  const restored = {email:element('email').value,appName:element('app-name').value,prompt:element('initial-prompt').value};
  element('email').value='test@example.com';element('app-name').value='Test app';element('initial-prompt').value='Make it';element('agreement').checked=true;
  return {element, calls, localStorage, sessionStorage, restored, submit:()=>element('create-ios-app-form').listeners.submit({preventDefault(){}}), poll:()=>timer()};
}
for(const status of ['missing_invitation','invalid_invitation','invitation_limit']) test(status+' bypasses GitHub completely',async()=>{
  const t=setup(status);await t.submit();assert.equal(t.calls.length,1);assert.equal(t.calls[0].headers.Authorization,undefined);assert.equal(t.element('create-ios-app-form').hidden,false);assert.equal(t.element('app-result').hidden,true);assert.equal(t.element('github-login').hidden,true);assert.match(t.element('invitation-error').textContent,/request has been saved/);assert.equal(t.element('submit').textContent,'Create iOS app');
});
for(const connected of [false,true]) test('success with '+(connected?'valid':'expired')+' session',async()=>{
  const t=setup('finished',connected,'success');await t.submit();assert.equal(t.calls.length,1);await t.poll();assert.equal(t.element('github-login').hidden,connected);assert.equal(t.element('repository-link').hidden,!connected);assert.equal(t.element('result-title').textContent,'App successfully created!');assert.equal(t.element('invitation-error').textContent,'');if(!connected)assert.equal(t.localStorage.getItem('vibe-github-session'),null);assert.ok(t.calls.filter(c=>c.url.includes('create-app')).every(c=>!c.headers.Authorization));
});
test('running Copilot does not check identity',async()=>{const t=setup('issue_created');await t.submit();await t.poll();assert.ok(t.calls.every(c=>!c.url.endsWith('github-auth')));});
test('failed Copilot permits access without claiming success',async()=>{const t=setup('repository_created',true,'failed');await t.submit();await t.poll();assert.equal(t.element('repository-link').hidden,false);assert.equal(t.element('apple-email-message').hidden,true);assert.match(t.element('resultMessage')?.textContent||t.element('result-message').textContent,/Copilot could not complete/);assert.equal(t.element('result-title').textContent,'Your repository is ready');});


test('normal refresh ignores old request and restores only unsent text', async()=>{
 const t=setup('finished',false,'success',{saved:{id:'00000000-0000-4000-8000-000000000001',key:'a'.repeat(64),invitation:'082b'},draft:{email:'draft@example.com',appName:'Unsent',prompt:'My draft'}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.calls.length,0);assert.equal(t.sessionStorage.getItem('vibe-app-request'),null);assert.equal(t.restored.prompt,'My draft');assert.equal(t.element('form-status').textContent,'');
});
test('successful submission clears draft and does not persist request', async()=>{
 const t=setup('finished',false,'success'); t.element('initial-prompt').listeners.input();assert.ok(t.localStorage.getItem('vibe-app-draft:082b'));await t.submit();assert.equal(t.localStorage.getItem('vibe-app-draft:082b'),null);assert.equal(t.sessionStorage.getItem('vibe-app-request'),null);
});
test('OAuth return resumes only the request tied to login', async()=>{
 const t=setup('finished',false,'success',{hash:'#login_error=cancelled',saved:{id:'00000000-0000-4000-8000-000000000001',key:'a'.repeat(64),invitation:'082b'}});
 await new Promise(resolve=>setImmediate(resolve));assert.ok(t.calls.some(c=>c.url.includes('?requestId=00000000-0000-4000-8000-000000000001')));
});

test('page load makes no server requests', async()=>{const t=setup('created');await new Promise(resolve=>setImmediate(resolve));assert.equal(t.calls.length,0);assert.equal(t.element('submit').disabled,false);});
test('limit response retains editable draft and permits another submission',async()=>{const t=setup('invitation_limit');await t.submit();assert.match(t.element('invitation-error').textContent,/reached the app limit/);assert.ok(t.localStorage.getItem('vibe-app-draft:082b'));assert.equal(t.element('submit').disabled,false);await t.submit();assert.equal(t.calls.length,2);assert.notEqual(t.calls[0].body.get('requestId'),t.calls[1].body.get('requestId'));});

for (const hash of ['#login_ticket=ticket', '#login_error=cancelled']) test('OAuth return hides form before requests resolve: '+hash, async()=>{
 const t=setup('finished',true,'success',{hash,saved:{id:'00000000-0000-4000-8000-000000000001',key:'a'.repeat(64),invitation:'082b'}});
 assert.equal(t.element('create-ios-app-form').hidden,true);
 assert.equal(t.element('app-result').hidden,false);
 assert.equal(t.element('repository-link').hidden,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.element('create-ios-app-form').hidden,true);
});
for (const accessStatus of ['pending','repository_invited','collaborator_present']) test('repository link matches access state: '+accessStatus,async()=>{
 const t=setup('finished',true,'success',{accessStatus});await t.submit();await t.poll();
 assert.equal(t.element('repository-link').hidden,accessStatus==='pending');
 assert.equal(t.element('result-message').textContent.includes('Preparing'),accessStatus==='pending');
});
test('Create Another App resets the screen without a server request',async()=>{
 const t=setup('finished',true,'success');await t.submit();await t.poll();const count=t.calls.length;
 t.element('create-another-app').listeners.click();
 assert.equal(t.element('create-ios-app-form').hidden,false);assert.equal(t.element('app-result').hidden,true);
 assert.equal(t.element('submit').disabled,false);assert.equal(t.calls.length,count);
});
