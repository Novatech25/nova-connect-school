const baseConfig = require("./base");

module.exports = {
  ...baseConfig,
  extends: [
    ...baseConfig.extends,
    "plugin:react-native/all",
  ],
  plugins: ["react-native"],
  rules: {
    ...baseConfig.rules,
    "react-native/no-inline-styles": "warn",
    "react-native/no-color-literals": "warn",
  },
};
