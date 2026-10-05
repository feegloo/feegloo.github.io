import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHelloServer, createHttpServer } from './hello.mjs';
import { createWorkflowServer } from './workflow.mjs';
import { createStatusReader, runState } from './status.mjs';

async function clientFor(server, t) {
  const client = new Client({ name: 'tutorial-test', version: '1' });
  const [a,b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  t.after(() => Promise.all([server.close(), client.close()]));
  return client;
}
test('Hello World can be discovered and invoked through MCP', async t => {
  const client = await clientFor(createHelloServer(), t);
  assert.equal((await client.listTools()).tools[0].name, 'hello_world');
  assert.equal((await client.callTool({ name: 'hello_world', arguments: { name: 'World' } })).content[0].text, 'Hello, World!');
});
test('workflow tool publishes the UI resource and returns structured current status', async t => {
  const client = await clientFor(createWorkflowServer(async args => ({ ...args, state: 'success' }), '<div>card</div>'), t);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 3);
  assert.equal(tools.find(x => x.name === 'show_workflow_status')._meta.ui.resourceUri, 'ui://workflow/card.html');
  const result = await client.callTool({ name:'show_workflow_status', arguments:{sha:'a'.repeat(40)} });
  assert.equal(result.structuredContent.watch.state, 'success');
  assert.equal((await client.readResource({uri:'ui://workflow/card.html'})).contents[0].mimeType, 'text/html;profile=mcp-app');
  const invalid = await client.callTool({ name:'get_workflow_status', arguments:{sha:'main'} });
  assert.equal(invalid.isError,true);
});
test('HTTP endpoint supports stateless MCP initialize and tool call', async t => {
  const server=createHttpServer(createHelloServer);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/health')).status,200);
  const rpc=async (method,params)=>{
    const response=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
    assert.equal(response.status,200);return response.json();
  };
  assert.equal((await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}})).result.serverInfo.name,'hello-mcp');
  assert.equal((await rpc('tools/call',{name:'hello_world',arguments:{name:'MCP'}})).result.content[0].text,'Hello, MCP!');
});
for (const [run,state] of [[null,'waiting'],[{status:'queued'},'running'],[{status:'completed',conclusion:'success'},'success'],[{status:'completed',conclusion:'failure'},'failure'],[{status:'completed',conclusion:'cancelled'},'cancelled'],[{status:'completed',conclusion:'skipped'},'skipped']]) {
  test(`maps GitHub state ${state}`,()=>assert.equal(runState(run),state));
}
test('reader matches exact SHA, picks newest rerun and caches calls', async()=>{
  let calls=0;const sha='a'.repeat(40);
  const read=createStatusReader('example/demo',async url=>{calls++;assert.equal(url.searchParams.get('head_sha'),sha);return {ok:true,json:async()=>({workflow_runs:[{id:1,head_sha:sha,status:'completed',conclusion:'failure'},{id:2,head_sha:sha,status:'completed',conclusion:'success',html_url:'https://github.com/example/demo/actions/runs/2'},{id:3,head_sha:'b'.repeat(40),status:'completed',conclusion:'failure'}]})};});
  assert.equal((await read({sha,workflow:'demo.yml'})).state,'success');
  await read({sha,workflow:'demo.yml'});assert.equal(calls,1);
});
test('reader does not turn API errors into success or a missing run', async()=>{
  const read=createStatusReader('example/demo',async()=>({ok:false,status:403}));
  await assert.rejects(read({sha:'a'.repeat(40),workflow:'demo.yml'}),/HTTP 403/);
});

test('fresh reads bypass the cached running result after completion', async () => {
  let completed = false;
  const sha = 'b'.repeat(40);
  const read = createStatusReader('example/demo', async () => ({ ok: true,
    json: async () => ({ workflow_runs: [{ id: 1, head_sha: sha,
      status: completed ? 'completed' : 'in_progress', conclusion: completed ? 'success' : null }] }) }));
  const args = { sha, workflow: 'demo.yml' };
  assert.equal((await read(args)).state, 'running');
  completed = true;
  assert.equal((await read(args)).state, 'running');
  assert.equal((await read(args, { fresh: true })).state, 'success');
});
