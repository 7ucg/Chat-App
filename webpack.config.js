const path = require('path');

module.exports = {
  mode: 'production',     // aktiviert automatisch Minify!
  entry: './Website/JS/client.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'Website/JS2'),
    clean: true
  },
  devtool: false           // verhindert Source Maps (kein DevTools-Code)
};
