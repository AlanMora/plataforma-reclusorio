const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/reporting-service'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      // En Docker dev se omite el type-check (ForkTsChecker) para ahorrar memoria;
      // el IDE y el build de producción siguen validando tipos.
      skipTypeChecking: process.env.SKIP_TYPE_CHECK === 'true',
    }),
  ],
};
