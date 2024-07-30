export default {
  transform: {
    "^.+\\.tsx?$": "babel-jest"
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.spec.ts']
};

