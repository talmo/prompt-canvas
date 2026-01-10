import path from 'path';

export const config = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.wdio.json',
      transpileOnly: true,
    },
  },

  specs: ['./e2e/**/*.test.ts'],
  exclude: [],

  maxInstances: 1,

  capabilities: [
    {
      browserName: 'vscode',
      browserVersion: 'stable',
      'wdio:vscodeOptions': {
        extensionPath: path.join(__dirname),
        workspacePath: path.join(__dirname, 'src', 'test', 'fixtures'),
        userSettings: {
          'editor.fontSize': 14,
        },
      },
    },
  ],

  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  services: ['vscode'],

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
};
