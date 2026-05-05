/* eslint-disable */
declare const __dirname: string;

const transformImportMetaEnvForJest = `${__dirname}/jest-import-meta-env-plugin.cjs`;

export default {
  displayName: 'drawnix',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      {
        presets: ['@nx/react/babel'],
        plugins: [transformImportMetaEnvForJest],
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/drawnix',
};
