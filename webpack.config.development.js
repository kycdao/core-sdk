const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/browser-init.ts',
  target: 'web',
  devtool: 'eval-cheap-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      crypto: false,
      stream: false,
    },
  },
  output: {
    filename: 'kycdao-sdk.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'kycDaoSdk',
  },
  devServer: {
    static: false,
    compress: true,
    port: 4000,
    allowedHosts: ['.tunnelto.dev'],
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
};
