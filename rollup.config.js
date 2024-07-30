import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/siterender.ts',
  output: {
    file: 'build/siterender.mjs',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
    })
  ],
  external: [
    'axios',
    'puppeteer',
    'yargs'
  ],
};

