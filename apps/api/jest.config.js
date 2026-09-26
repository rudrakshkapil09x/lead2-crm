/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      useESM: true,
      diagnostics: { ignoreCodes: [151002] },
    }],
    // Transpile ESM-only node_modules used in tests
    '^.+\\.m?js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'auto' }]] }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(sanitize-html|htmlparser2|domhandler|domutils|dom-serializer|entities|domelementtype|css-what|nth-check|boolbase|css-select)/).*',
  ],
  testEnvironment: 'node',
  testTimeout: 60000,
};
