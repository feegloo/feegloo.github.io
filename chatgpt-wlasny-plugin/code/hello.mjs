import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';

export function createHelloServer() {
  const server = new McpServer({ name: 'hello-mcp', version: '1.0.0' });
  server.registerTool('hello_world', {
    title: 'Hello World', description: 'Return a greeting from this MCP server.',
    inputSchema: { name: z.string().min(1).max(80).default('World') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: 'noauth' }] },
  }, async ({ name }) => ({ content: [{ type: 'text', text: `Hello, ${name}!` }] }));
  return server;
}

export function createHttpServer(makeServer) {
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      return;
    }
    if (path !== '/mcp') { res.writeHead(404).end('Not Found'); return; }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version, Mcp-Session-Id' }).end();
      return;
    }
    if (!['POST', 'GET', 'DELETE'].includes(req.method)) { res.writeHead(405).end(); return; }
    res.setHeader('Access-Control-Allow-Origin', '*');
    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res); }
    catch { if (!res.headersSent) res.writeHead(500).end('MCP request failed'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createHttpServer(createHelloServer).listen(Number(process.env.PORT ?? 8787), '0.0.0.0', () => {
    console.log('Hello MCP: http://localhost:8787/mcp');
  });
}
