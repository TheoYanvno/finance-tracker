// Builds the app into docs/ (what GitHub Pages serves): one bundled, minified script plus the page
// and styles. `npm start` rebuilds on every change and serves it at http://localhost:8000.
import * as esbuild from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

const serve = process.argv.includes('--serve');
await mkdir('docs', { recursive: true });
await cp('public', 'docs', { recursive: true });

const options = {
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outfile: 'docs/app.js',
  jsx: 'automatic',
  minify: !serve,
  sourcemap: serve,
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': serve ? '"development"' : '"production"' },
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'docs', port: 8000 });
  console.log(`Serving http://localhost:${port}`);
} else {
  await esbuild.build(options);
}
