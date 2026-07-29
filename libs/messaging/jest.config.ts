export default {
  displayName: 'messaging',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  moduleNameMapper: {
    '^@icms/(.*)$': '<rootDir>/../$1/src',
  },
  coverageDirectory: '../../coverage/libs/messaging',
};
