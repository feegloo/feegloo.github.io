import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const result = await build({ entryPoints: ['widget.js'], bundle: true, platform: 'browser', format: 'iife', target: 'es2022', minify: true, write: false });
await mkdir('dist', { recursive: true });
const html = await readFile('public/widget.html', 'utf8');
await writeFile('dist/widget.html', html.replace('/* WIDGET_BUNDLE */', () => result.outputFiles[0].text.replaceAll('</script', '<\\/script')));
