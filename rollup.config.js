import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import html from '@rollup/plugin-html';
import copy from 'rollup-plugin-copy';

export default {
  input: 'web/components/app-main.ts',
  output: {
    dir: 'dist/web',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: 'web/tsconfig.json',
      sourceMap: true,
      inlineSources: true
    }),
    html({
      fileName: 'index.html',
      title: 'LarsWorld - Chunk-Based World Generator',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }
      ],
      template: ({ attributes, files, meta, publicPath, title }) => {
        const scripts = (files.js || [])
          .map(({ fileName }) => `<script type="module" src="${publicPath}${fileName}"></script>`)
          .join('\n    ');

        const metaTags = meta.map(tag => {
          if (tag.charset) {
            return `<meta charset="${tag.charset}">`;
          }
          return `<meta name="${tag.name}" content="${tag.content}">`;
        }).join('\n    ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    ${metaTags}
    <title>${title}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
        
        /* Reset for custom elements */
        app-main {
            display: block;
        }
    </style>
</head>
<body>
    <app-main></app-main>
    
    ${scripts}
</body>
</html>`;
      }
    }),
    copy({
      targets: [
        // Copy any additional static assets if needed
        // { src: 'web/assets/**/*', dest: 'dist/web/assets' }
      ]
    })
  ]
};