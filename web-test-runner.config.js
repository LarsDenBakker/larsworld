import { esbuildPlugin } from '@web/dev-server-esbuild';
import { chromeLauncher } from '@web/test-runner';

export default {
  nodeResolve: true,
  files: 'test/**/*.test.js',
  browsers: [
    chromeLauncher({
      launchOptions: {
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      },
    }),
  ],
  plugins: [
    esbuildPlugin({
      ts: true,
      target: 'auto',
    }),
  ],
  testFramework: {
    config: {
      timeout: 10000,
    },
  },
};
