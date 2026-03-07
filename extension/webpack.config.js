const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    background: "./src/background/index.ts",
    content_chatgpt: "./src/content/chatgpt.ts",
    content_claude: "./src/content/claude.ts",
    popup: "./src/popup/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "popup.html", to: "popup.html" },
        { from: "icons", to: "icons", noErrorOnMissing: true },
      ],
    }),
  ],
  // No inline source maps — Chrome extensions reject them
  devtool: false,
};
