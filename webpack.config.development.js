const path = require('path');
const webpack = require('webpack');

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
    modules: [path.resolve(__dirname, '.'), 'node_modules'],
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NEAR_NO_LOGS: true,
      },
    }),
  ],
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
