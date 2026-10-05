import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { createHelloServer, createHttpServer } from './hello.mjs';
import { createStatusReader } from './status.mjs';

const uri = 'ui://workflow/card.html';
export function createWorkflowServer(readStatus, html) {
  const server = createHelloServer();
  server.registerResource('workflow-card', uri, {}, async () => ({ contents: [{
    uri, mimeType: 'text/html;profile=mcp-app', text: html,
    _meta: { ui: { prefersBorder: false } },
  }] }));
  const inputSchema = {
    sha: z.string().regex(/^[a-f0-9]{40}$/).describe('Exact full commit SHA, not main or latest.'),
    workflow: z.string().regex(/^[\w.-]+\.ya?ml$/).default('demo.yml'),
  };
  const read = async (args, fresh = false) => {
    try {
      const watch = await readStatus(args, { fresh });
      return { content: [{ type: 'text', text: `Workflow: ${watch.state}\n${watch.runUrl ?? watch.commitUrl}` }],
        structuredContent: { watch } };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
  };
  for (const name of ['get_workflow_status', 'show_workflow_status']) {
    server.registerTool(name, {
      title: name === 'show_workflow_status' ? 'Show workflow card' : 'Read workflow status',
      description: 'Read the status of the configured public repository and exact commit. Does not start workflows.',
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      _meta: { securitySchemes: [{ type: 'noauth' }], ...(name === 'show_workflow_status' ? {
        ui: { resourceUri: uri }, 'openai/outputTemplate': uri,
      } : {}) },
    }, args => read(args, name === 'get_workflow_status'));
  }
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const readStatus = createStatusReader(process.env.GITHUB_REPOSITORY ?? '');
  const html = readFileSync(new URL('./dist/widget.html', import.meta.url), 'utf8');
  createHttpServer(() => createWorkflowServer(readStatus, html)).listen(Number(process.env.PORT ?? 8787), '0.0.0.0');
}
