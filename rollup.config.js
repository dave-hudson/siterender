import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/siterender.ts',
  output: {
    file: 'build/siterender.mjs', // Use .mjs extension for ES module
    format: 'esm', // Output format as ESM
    sourcemap: true
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: 'tsconfig.json'
    })
  ],
  external: [
    'fs',
    'path',
    'os',
    'http',
    'https',
    'axios',
    'puppeteer',
    'yargs',
    'fast-xml-parser'
  ]
};

