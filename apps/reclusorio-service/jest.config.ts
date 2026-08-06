export default {
  displayName: 'reclusorio-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  moduleNameMapper: { '^@icms/(.*)$': '<rootDir>/../../libs/$1/src' },
  coverageDirectory: '../../coverage/apps/reclusorio-service',
};
