const webpack = require('webpack');

module.exports = {
  mode: 'development', // oder 'production'
  entry: './server.js', // oder dein richtiger Pfad
  resolve: {
    fallback: {
    
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ],
  // ggf. noch output und weitere Einstellungen
};
