import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL(process.env.FRONTEND_PATH || '../../../udid/app.js', import.meta.url), 'utf8');
function run(state, pending) {
  const elements = Object.fromEntries(['start','result','udid','status','download','copy','clear'].map(id => [id, {hidden:id === 'result',addEventListener(){}}]));
  let removed = false, cleared = false;
  vm.runInNewContext(source, { document:{getElementById:id=>elements[id]}, location:{hash:`#udid=00000000-0000000000000001&state=${state}`,pathname:'/udid/'}, history:{replaceState(){cleared=true}}, URLSearchParams, localStorage:{getItem:()=>JSON.stringify(pending),removeItem(){removed=true}}, Date });
  return {elements, removed, cleared};
}
test('frontend binds returned UDID to local session and clears URL',()=>{
 const result=run('abc',{state:'abc',created:Date.now()});
 assert.equal(result.elements.result.hidden,false);assert.equal(result.removed,true);assert.equal(result.cleared,true);
 const wrong=run('wrong',{state:'abc',created:Date.now()});assert.equal(wrong.elements.result.hidden,true);assert.ok(wrong.elements.status.textContent);
 const expired=run('abc',{state:'abc',created:Date.now()-1801000});assert.equal(expired.elements.result.hidden,true);
});
