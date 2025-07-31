import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  rootDir: 'web',
  nodeResolve: true,
  preserveSymlinks: true,
  port: 3001,
  appIndex: 'index.html',
  plugins: [
    esbuildPlugin({ 
      ts: true,
      target: 'auto'
    })
  ],
  middleware: [
    // Proxy API requests to the backend server
    async (ctx, next) => {
      if (ctx.path.startsWith('/api/')) {
        // Forward API requests to the Express server
        const apiUrl = `http://localhost:3000${ctx.path}`;
        const { method } = ctx.request;
        
        try {
          let body = undefined;
          if (method !== 'GET' && ctx.request.body) {
            // Get the request body for non-GET requests
            body = JSON.stringify(ctx.request.body);
          }

          const response = await fetch(apiUrl, {
            method,
            headers: {
              'Content-Type': 'application/json'
            },
            body
          });

          ctx.status = response.status;
          ctx.body = await response.text();
          ctx.set('Content-Type', response.headers.get('content-type') || 'application/json');
        } catch (error) {
          console.error('API proxy error:', error);
          ctx.status = 500;
          ctx.body = JSON.stringify({ error: 'API proxy error' });
        }
      } else {
        await next();
      }
    }
  ]
};