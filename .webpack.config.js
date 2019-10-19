const path = require('path');

//module.exports = {
//  module: {
//    target: 'electron-renderer',
//    rules: [{
//      test: /\.js$/,
//      use: {
//        loader: "remove-hashbag-loader"
//      }
//    }]
//  },
//  resolveLoader: {
//    alias: {
//      "Hremove-hashbag-loader": path.join(__dirname, "./loaders/remove-hashbag-loader")
//    }
//  }
//};
module.exports = config => {
  config.target = 'electron-renderer';
  //config.module.rules.push({
  //  test: /\.js$/,
  //  use: [path.join(__dirname, "./loaders/remove-hashbag-loader")]
  //});
  //config.module.resolveLoader = {
  //  alias: {
  //    "remove-hadhbag-loader": path.join(__dirname, "./loaders/remove-hashbag-loader"),
  //  }
  //}
  return config;
}
